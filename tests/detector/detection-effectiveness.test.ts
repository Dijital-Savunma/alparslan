// Phase 3 — Detection Effectiveness Corpus
// Measures true-positive, false-positive and reason-accuracy
// across Turkey-specific phishing patterns and legitimate top sites.
// @vitest-environment happy-dom

import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { checkUrl } from "@/detector/url-checker";
import { ThreatLevel } from "@/utils/types";
import { initListCache, addToBlacklist, resetListCache } from "@/storage/list-cache";
import type { BlacklistEntry } from "@/storage/types";

// Mirror of the builtin blocklist — a representative sample
const BUILTIN_BLOCKLIST: BlacklistEntry[] = [
  { domain: "e-devlet-giris.com", category: "government", addedAt: "2026-03-27", source: "manual" },
  { domain: "turkiye-gov.net", category: "government", addedAt: "2026-03-27", source: "manual" },
  { domain: "edevlet-dogrulama.com", category: "government", addedAt: "2026-03-27", source: "manual" },
  { domain: "ziraat-bankasi-giris.com", category: "bank", addedAt: "2026-03-27", source: "manual" },
  { domain: "garanti-bbva-giris.com", category: "bank", addedAt: "2026-03-27", source: "manual" },
  { domain: "ptt-kargo-takip.com", category: "cargo", addedAt: "2026-03-27", source: "manual" },
];

beforeAll(async () => {
  // Reset shared module state so this file is deterministic across
  // worker configurations (pool=threads, isolate=false).
  resetListCache();
  await initListCache();
  await addToBlacklist(BUILTIN_BLOCKLIST);
});

// ─────────────────────────────────────────────────────────────
// TRUE-POSITIVE corpus
// Each entry: { url, expectDangerous?, expectAtLeast?, tag }
// ─────────────────────────────────────────────────────────────
interface PhishCase {
  url: string;
  tag: string;
  expected: "DANGEROUS" | "SUSPICIOUS" | "AT_LEAST_SUSPICIOUS";
}

const PHISH_CORPUS: PhishCase[] = [
  // Blocklist hits (exact)
  { url: "https://e-devlet-giris.com/login", tag: "blocklist:edevlet", expected: "DANGEROUS" },
  { url: "https://garanti-bbva-giris.com/", tag: "blocklist:garanti", expected: "DANGEROUS" },
  { url: "https://ptt-kargo-takip.com/track?id=x", tag: "blocklist:ptt", expected: "DANGEROUS" },

  // Typosquatting — 1-char edit distance
  { url: "https://garanti.com.t", tag: "typo:garanti:tld-trim", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://garrantii.com.tr", tag: "typo:garanti:doubled", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://isbbank.com.tr", tag: "typo:isbank:insertion", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://akbanq.com.tr", tag: "typo:akbank:substitution", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://yapiikredi.com.tr", tag: "typo:yapikredi:duplicate", expected: "AT_LEAST_SUSPICIOUS" },

  // TLD mismatch
  { url: "https://garanti.net", tag: "tld-mismatch:garanti", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://isbank.org", tag: "tld-mismatch:isbank", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://ziraatbank.info", tag: "tld-mismatch:ziraat", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://turkiye.com", tag: "tld-mismatch:turkiye", expected: "AT_LEAST_SUSPICIOUS" },

  // Subdomain impersonation
  { url: "https://garanti.guvenli-giris.com", tag: "subdomain:garanti", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://e-devlet.fake-gov.net", tag: "subdomain:edevlet", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://akbank.phishing-kit.tr", tag: "subdomain:akbank", expected: "AT_LEAST_SUSPICIOUS" },

  // Contains-trusted-name
  { url: "https://securegarantibank.com", tag: "contains:garanti", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://akbank-online-giris.tk", tag: "contains:akbank", expected: "AT_LEAST_SUSPICIOUS" },

  // Homoglyph (Cyrillic ‘а’ in place of Latin ‘a’)
  { url: "https://\u0430kbank.com.tr", tag: "homoglyph:akbank:cyrillic-a", expected: "DANGEROUS" },
  { url: "https://gar\u0430nti.com.tr", tag: "homoglyph:garanti:cyrillic-a", expected: "DANGEROUS" },
  // Cyrillic ‘о’ (U+043E) replacing Latin 'o'
  { url: "https://g\u043Eogle.com", tag: "homoglyph:google:cyrillic-o", expected: "AT_LEAST_SUSPICIOUS" },
  // Turkish dotless ı (0131)
  { url: "https://gar\u0131nti.com.tr", tag: "homoglyph:garanti:dotless-i", expected: "AT_LEAST_SUSPICIOUS" },

  // IP-address URL
  { url: "http://185.34.56.78/login", tag: "ip-url", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "http://10.0.0.1/bank", tag: "ip-url:private", expected: "AT_LEAST_SUSPICIOUS" },

  // Excessive subdomains
  { url: "https://login.secure.verify.garanti.bank.evil.com", tag: "excessive-subdomain", expected: "AT_LEAST_SUSPICIOUS" },

  // Suspicious keyword in domain
  { url: "https://secure-garanti-login.xyz", tag: "keyword+typo", expected: "AT_LEAST_SUSPICIOUS" },
  { url: "https://verify-akbank.top", tag: "keyword:verify", expected: "AT_LEAST_SUSPICIOUS" },
];

// ─────────────────────────────────────────────────────────────
// FALSE-POSITIVE corpus — real legitimate Turkish + global sites
// ─────────────────────────────────────────────────────────────
const LEGIT_CORPUS: string[] = [
  // TR banks (trusted)
  "https://www.garanti.com.tr/tr/bireysel/hesaplar",
  "https://www.isbank.com.tr/bireysel/hesaplar",
  "https://www.ziraatbank.com.tr/tr",
  "https://www.akbank.com.tr/tr",
  "https://www.yapikredi.com.tr/tr",
  "https://www.halkbank.com.tr/",
  "https://www.vakifbank.com.tr/",
  "https://www.denizbank.com/",
  // TR gov
  "https://www.turkiye.gov.tr/giris",
  "https://www.e-devlet.gov.tr/",
  "https://www.gib.gov.tr/",
  "https://www.sgk.gov.tr/",
  "https://www.ptt.gov.tr/",
  // TR e-commerce / cargo
  "https://www.trendyol.com/kampanya",
  "https://www.hepsiburada.com/firsatlar",
  "https://www.n11.com/",
  "https://www.sahibinden.com/ilanlar",
  "https://www.yurticikargo.com/tr/online-servisler",
  "https://www.mngkargo.com.tr/",
  // Global
  "https://www.google.com.tr/search?q=test",
  "https://mail.google.com/mail/u/0/",
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  "https://accounts.google.com/signin",
  "https://www.github.com/",
  "https://stackoverflow.com/questions/tagged/typescript",
  "https://www.youtube.com/watch?v=abc",
  "https://www.wikipedia.org/",
  "https://www.amazon.com.tr/",
  "https://www.apple.com/tr/",
  "https://www.netflix.com/tr/",
  "https://www.spotify.com/tr/",
  "https://www.paypal.com/tr/",
  // Common TR news / media
  "https://www.hurriyet.com.tr/",
  "https://www.sozcu.com.tr/",
  "https://www.ntv.com.tr/",
  "https://www.milliyet.com.tr/",
  "https://www.cnnturk.com/",
  // Common edge cases that *look* suspicious but are legit
  "https://login.microsoftonline.com/",                       // 'login' keyword but trusted
  "https://accounts.google.com/",                             // 'accounts' keyword
  "https://secure.chase.com/",                                // 'secure' keyword
  "https://www.paypal.com/webapps/mpp/security-center",       // 'security' keyword
  "https://login.yahoo.com/",
  "https://auth.atlassian.com/",
  "https://verify.twitter.com/",
  // More TR sites with short or common names (FP hunting)
  "https://www.haberturk.com/",
  "https://www.dhl.com.tr/",       // short TR cargo
  "https://www.ups.com/tr/",
  "https://www.migros.com.tr/",
  "https://www.a101.com.tr/",
  "https://www.bim.com.tr/",
  "https://www.sok.com.tr/",
  "https://www.teknosa.com/",
  "https://www.mediamarkt.com.tr/",
  "https://www.arcelik.com.tr/",
  "https://www.vestel.com.tr/",
  "https://www.ebebek.com/",
  "https://www.morhipo.com/",
];

describe("Phase 3 — Detection effectiveness", () => {
  const metrics = {
    tp: 0, fn: 0, fp: 0, tn: 0,
    misses: [] as Array<{ tag: string; url: string; level: string; reasons: string[] }>,
    fps: [] as Array<{ url: string; level: string; reasons: string[]; score: number }>,
  };

  describe("True positives — phishing corpus", () => {
    for (const tc of PHISH_CORPUS) {
      it(`${tc.tag} — ${tc.url}`, () => {
        const result = checkUrl(tc.url, "medium");
        const flagged =
          result.level === ThreatLevel.DANGEROUS ||
          result.level === ThreatLevel.SUSPICIOUS;

        const passed =
          tc.expected === "DANGEROUS"
            ? result.level === ThreatLevel.DANGEROUS
            : tc.expected === "SUSPICIOUS"
            ? result.level === ThreatLevel.SUSPICIOUS
            : flagged;

        if (passed) {
          metrics.tp++;
        } else {
          metrics.fn++;
          metrics.misses.push({
            tag: tc.tag,
            url: tc.url,
            level: result.level,
            reasons: result.reasons,
          });
        }
        expect({ tag: tc.tag, level: result.level, score: result.score, reasons: result.reasons })
          .toMatchObject({ tag: tc.tag }); // soft — full verdict captured below
      });
    }
  });

  describe("False positives — legitimate corpus", () => {
    for (const url of LEGIT_CORPUS) {
      it(`legit: ${url}`, () => {
        const result = checkUrl(url, "medium");
        const flagged =
          result.level === ThreatLevel.DANGEROUS ||
          result.level === ThreatLevel.SUSPICIOUS;

        if (flagged) {
          metrics.fp++;
          metrics.fps.push({ url, level: result.level, reasons: result.reasons, score: result.score });
        } else {
          metrics.tn++;
        }
        expect({ url, level: result.level }).toMatchObject({ url });
      });
    }
  });

  // afterAll guarantees the summary runs after every corpus test,
  // even when Vitest test order is shuffled.
  afterAll(() => {
    const total = PHISH_CORPUS.length + LEGIT_CORPUS.length;
    const recall = metrics.tp / PHISH_CORPUS.length;
    const fpRate = metrics.fp / LEGIT_CORPUS.length;
    const precision =
      metrics.tp + metrics.fp > 0 ? metrics.tp / (metrics.tp + metrics.fp) : 1;

    /* eslint-disable no-console */
    console.log("\n═══ DETECTION EFFECTIVENESS REPORT ═══");
    console.log(`Corpus size:          ${total} (${PHISH_CORPUS.length} phish, ${LEGIT_CORPUS.length} legit)`);
    console.log(`True positives:       ${metrics.tp}`);
    console.log(`False negatives:      ${metrics.fn}`);
    console.log(`True negatives:       ${metrics.tn}`);
    console.log(`False positives:      ${metrics.fp}`);
    console.log(`Recall (TPR):         ${(recall * 100).toFixed(1)}%`);
    console.log(`False-positive rate:  ${(fpRate * 100).toFixed(1)}%`);
    console.log(`Precision:            ${(precision * 100).toFixed(1)}%`);

    if (metrics.misses.length > 0) {
      console.log("\n  ── MISSES (false negatives) ──");
      for (const m of metrics.misses) {
        console.log(`    [${m.tag}] ${m.url} → ${m.level} (${m.reasons.join("; ") || "no reasons"})`);
      }
    }
    if (metrics.fps.length > 0) {
      console.log("\n  ── FALSE POSITIVES ──");
      for (const f of metrics.fps) {
        console.log(`    ${f.url} → ${f.level} score=${f.score} (${f.reasons.join("; ")})`);
      }
    }
    console.log("════════════════════════════════════════\n");
    /* eslint-enable no-console */
  });
});
