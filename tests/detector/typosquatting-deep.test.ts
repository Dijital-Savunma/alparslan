/**
 * Deep exploration of the improved typosquatting detection system.
 *
 * Tests cover:
 * 1. Damerau-Levenshtein (transpositions cost 1, not 2)
 * 2. Same name / different TLD detection
 * 3. Subdomain impersonation detection
 * 4. Substring/contains detection for long prefixes
 * 5. Unicode homoglyph normalization
 * 6. Separator stripping (hyphens, dots)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  levenshteinDistance,
  checkTyposquatting,
  checkUrl,
  loadBlocklist,
  normalizeHomoglyphs,
  decodePunycodeDomain,
} from "@/detector/url-checker";
import { ThreatLevel } from "@/utils/types";

beforeEach(() => {
  loadBlocklist([], true);
});

// ─── DAMERAU-LEVENSHTEIN (IMPROVEMENT #4) ─────────────────────────
describe("Damerau-Levenshtein — transpositions now cost 1", () => {
  it("adjacent swap costs 1, not 2 (garanti → garanit)", () => {
    // Old Levenshtein: 2 (delete + insert)
    // New Damerau-Levenshtein: 1 (single transposition)
    expect(levenshteinDistance("garanti", "garanit")).toBe(1);
  });

  it("adjacent swap costs 1 (paypal → paypla)", () => {
    expect(levenshteinDistance("paypal", "paypla")).toBe(1);
  });

  it("non-adjacent swap still costs 2 (abcde → aedcb)", () => {
    // Only adjacent transpositions are cheap
    expect(levenshteinDistance("abcde", "aedcb")).toBeGreaterThan(1);
  });

  it("transposition now opens room for more detection", () => {
    // "garanit" (transposition) + one more edit = distance 2, still caught
    // Before: distance was 2 for just the transposition, leaving no room
    const result = checkTyposquatting("garanitt.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("garanti.com.tr");
  });
});

// ─── SAME NAME, DIFFERENT TLD (IMPROVEMENT #1) ───────────────────
describe("Same name, different TLD — NOW CAUGHT", () => {
  it("catches turkiye.com (same name as turkiye.gov.tr)", () => {
    const result = checkTyposquatting("turkiye.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("turkiye.gov.tr");
    expect(result.reason).toBe("tld-mismatch");
  });

  it("catches isbank.com (same name as isbank.com.tr)", () => {
    const result = checkTyposquatting("isbank.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
    expect(result.reason).toBe("tld-mismatch");
  });

  it("catches garanti.net (same name as garanti.com.tr)", () => {
    const result = checkTyposquatting("garanti.net");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("garanti.com.tr");
    expect(result.reason).toBe("tld-mismatch");
  });

  it("catches ziraatbank.org (same name as ziraatbank.com.tr)", () => {
    const result = checkTyposquatting("ziraatbank.org");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("ziraatbank.com.tr");
    expect(result.reason).toBe("tld-mismatch");
  });

  it("does NOT flag completely different names on common TLDs", () => {
    const result = checkTyposquatting("randomshop.com");
    expect(result.isSuspicious).toBe(false);
  });
});

// ─── SUBDOMAIN HIDING (IMPROVEMENT #2) ───────────────────────────
describe("Subdomain impersonation — NOW CAUGHT", () => {
  it("catches garanti.evil.com (trusted name in subdomain)", () => {
    const result = checkTyposquatting("garanti.evil.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("garanti.com.tr");
    expect(result.reason).toBe("subdomain-impersonation");
  });

  it("catches isbank.phishing.net (trusted name in subdomain)", () => {
    const result = checkTyposquatting("isbank.phishing.net");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
    expect(result.reason).toBe("subdomain-impersonation");
  });

  it("catches isbenk.evil.com (typosquat in subdomain)", () => {
    const result = checkTyposquatting("isbenk.evil.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
    expect(result.reason).toBe("subdomain-typosquat");
  });

  it("catches paypal.login.evil.com (deep subdomain hiding)", () => {
    const result = checkTyposquatting("paypal.login.evil.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("paypal.com");
    expect(result.reason).toBe("subdomain-impersonation");
  });
});

// ─── SUBSTRING/CONTAINS (IMPROVEMENT #3) ─────────────────────────
describe("Trusted name as substring — NOW CAUGHT", () => {
  it("catches securegaranti.com.tr (prefix + trusted name)", () => {
    const result = checkTyposquatting("securegaranti.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("garanti.com.tr");
    expect(result.reason).toBe("contains-trusted-name");
  });

  it("catches garantilogin.com (trusted name + suffix)", () => {
    const result = checkTyposquatting("garantilogin.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("garanti.com.tr");
    expect(result.reason).toBe("contains-trusted-name");
  });

  it("catches myisbankonline.com (prefix + trusted name + suffix)", () => {
    const result = checkTyposquatting("myisbankonline.com");
    expect(result.isSuspicious).toBe(true);
    // isbank is 6 chars ≥ 5, and "myisbankonline" contains "isbank"
    expect(result.similarTo).toBe("isbank.com.tr");
    expect(result.reason).toBe("contains-trusted-name");
  });

  it("catches hepsiburadaindirim.com (long trusted name embedded)", () => {
    const result = checkTyposquatting("hepsiburadaindirim.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("hepsiburada.com");
    expect(result.reason).toBe("contains-trusted-name");
  });

  it("does NOT flag short trusted name substrings to avoid false positives", () => {
    // "n11" is only 3 chars, so "n11something.com" should NOT trigger
    // contains check (too many false positives for short names)
    const result = checkTyposquatting("n11warehouse.com");
    // Could still be caught by edit-distance if close enough, but
    // substring check is disabled for names < 5 chars
    expect(result.reason).not.toBe("contains-trusted-name");
  });
});

// ─── UNICODE HOMOGLYPHS (IMPROVEMENT #5) ─────────────────────────
describe("Unicode homoglyph normalization — NOW CAUGHT", () => {
  it("normalizeHomoglyphs replaces Cyrillic lookalikes", () => {
    // "gооgle" with Cyrillic о (U+043E) → "google"
    expect(normalizeHomoglyphs("g\u043E\u043Egle")).toBe("google");
  });

  it("normalizeHomoglyphs replaces Greek lookalikes", () => {
    // "pαypal" with Greek α → "paypal"
    expect(normalizeHomoglyphs("p\u03B1ypal")).toBe("paypal");
  });

  it("normalizeHomoglyphs handles Turkish dotless ı", () => {
    expect(normalizeHomoglyphs("\u0131sbank")).toBe("isbank");
  });

  it("catches domain with Cyrillic о in name", () => {
    // "g + Cyrillic-о + Cyrillic-о + gle" looks like "google"
    const result = checkTyposquatting("g\u043E\u043Egle.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("google.com");
  });

  it("catches Turkish ı substitution in isbank", () => {
    const result = checkTyposquatting("\u0131sbank.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
  });

  it("normalizeHomoglyphs replaces Cyrillic ѕ and ј", () => {
    expect(normalizeHomoglyphs("\u0455ite")).toBe("site");
    expect(normalizeHomoglyphs("\u0458avascript")).toBe("javascript");
  });

  it("normalizeHomoglyphs replaces Cyrillic һ, к, т", () => {
    expect(normalizeHomoglyphs("\u04BBost")).toBe("host");
    expect(normalizeHomoglyphs("ban\u043Aa")).toBe("banka");
    expect(normalizeHomoglyphs("garan\u0442i")).toBe("garanti");
  });

  it("normalizeHomoglyphs replaces Greek ι, κ, ν, ρ, τ, υ", () => {
    expect(normalizeHomoglyphs("\u03B9sbank")).toBe("isbank");
    expect(normalizeHomoglyphs("ban\u03BAa")).toBe("banka");
    expect(normalizeHomoglyphs("de\u03BDlet")).toBe("devlet");
    expect(normalizeHomoglyphs("\u03C1aypal")).toBe("paypal");
    expect(normalizeHomoglyphs("garan\u03C4i")).toBe("garanti");
    expect(normalizeHomoglyphs("g\u03C5ven")).toBe("guven");
  });

  it("catches domain with Cyrillic ѕ substitution", () => {
    // "i\u0455bank" looks like "isbank"
    const result = checkTyposquatting("i\u0455bank.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
  });

  it("catches domain with mixed Cyrillic/Greek homoglyphs", () => {
    // "e-de\u03BDle\u0442" → "e-devlet" after normalization
    const result = checkTyposquatting("e-de\u03BDle\u0442.com");
    expect(result.isSuspicious).toBe(true);
  });
});

// ─── E-DEVLET CYRILLIC HOMOGLYPH ATTACKS ─────────────────────────
describe("e-devlet Cyrillic homoglyph attacks", () => {
  it("catches e-devlet with Cyrillic е (U+0435) for both e's", () => {
    // "\u0435-d\u0435vlet" → "e-devlet"
    const result = checkTyposquatting("\u0435-d\u0435vlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet with only first e as Cyrillic", () => {
    const result = checkTyposquatting("\u0435-devlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet with only second e as Cyrillic", () => {
    const result = checkTyposquatting("e-d\u0435vlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet with Cyrillic а (U+0430) replacing no char but full Cyrillic swap", () => {
    // all available Cyrillic replacements: е→e, v stays, т→t
    // "\u0435-d\u0435vl\u0435\u0442" → "e-devlet"
    const result = checkTyposquatting("\u0435-d\u0435vl\u0435\u0442.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet with Cyrillic т (U+0442) for t", () => {
    const result = checkTyposquatting("e-devle\u0442.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet on fake TLD with Cyrillic chars", () => {
    const result = checkTyposquatting("\u0435-d\u0435vlet.com");
    expect(result.isSuspicious).toBe(true);
  });

  it("catches edevlet without hyphen using Cyrillic е", () => {
    const result = checkTyposquatting("\u0435devlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
  });

  it("catches e-devlet with Greek ε (U+03B5) for e", () => {
    const result = checkTyposquatting("\u03B5-d\u03B5vlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });

  it("catches e-devlet with mixed Cyrillic е and Greek ν for v", () => {
    // "\u0435-de\u03BDlet" → Cyrillic е + Greek ν
    const result = checkTyposquatting("\u0435-de\u03BDlet.gov.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("e-devlet.gov.tr");
  });
});

// ─── PUNYCODE DECODING (IDN HOMOGLYPH ATTACKS) ──────────────────
describe("Punycode decoding — Chrome IDN domains", () => {
  it("decodePunycodeDomain decodes xn-- labels to Unicode", () => {
    // "xn--devlet-2of" is punycode for "е-devlet" (Cyrillic е)
    // We can verify by encoding: е (U+0435) in "е-devlet"
    const decoded = decodePunycodeDomain("xn--devlet-2of.com");
    expect(decoded).toContain("devlet");
    // The decoded domain should contain a non-ASCII char (the Cyrillic е)
    expect(decoded).not.toBe("devlet.com");
  });

  it("decodePunycodeDomain passes through normal domains unchanged", () => {
    expect(decodePunycodeDomain("google.com")).toBe("google.com");
    expect(decodePunycodeDomain("e-devlet.gov.tr")).toBe("e-devlet.gov.tr");
    expect(decodePunycodeDomain("isbank.com.tr")).toBe("isbank.com.tr");
  });

  it("catches punycode e-devlet with Cyrillic е (xn--devlet-2of.com)", () => {
    // Chrome shows: xn--devlet-2of.com (punycode for е-devlet.com with Cyrillic е)
    const result = checkTyposquatting("xn--devlet-2of.com");
    expect(result.isSuspicious).toBe(true);
  });

  it("catches punycode gmail with Cyrillic а (xn--gmil-63d.com)", () => {
    // Chrome shows: xn--gmil-63d.com (punycode for gmаil.com with Cyrillic а)
    const result = checkTyposquatting("xn--gmil-63d.com");
    expect(result.isSuspicious).toBe(true);
  });

  it("catches punycode google with Cyrillic о (xn--ggle-0nda.com)", () => {
    // "gооgle" with two Cyrillic о → punycode
    const result = checkTyposquatting("xn--ggle-0nda.com");
    expect(result.isSuspicious).toBe(true);
  });

  it("decodePunycodeDomain handles multiple xn-- labels", () => {
    const decoded = decodePunycodeDomain("xn--devlet-2of.xn--trkiye-03a.gov.tr");
    // Both labels should be decoded, not start with xn--
    expect(decoded).not.toContain("xn--");
  });
});

// ─── SEPARATOR STRIPPING (IMPROVEMENT #6) ─────────────────────────
describe("Separator stripping — hyphens and dots", () => {
  it("catches i-s-b-a-n-k.com.tr (hyphen-separated letters)", () => {
    const result = checkTyposquatting("i-s-b-a-n-k.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
  });

  it("catches is-bank.com.tr (single hyphen)", () => {
    const result = checkTyposquatting("is-bank.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
  });

  it("catches pay-pal.com (hyphenated global brand)", () => {
    const result = checkTyposquatting("pay-pal.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("paypal.com");
  });
});

// ─── ORIGINAL TESTS STILL PASS ───────────────────────────────────
describe("Original detection still works (no regressions)", () => {
  it("catches isbenk.com.tr (1 edit from isbank)", () => {
    const result = checkTyposquatting("isbenk.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
    expect(result.reason).toBe("edit-distance");
  });

  it("catches gogle.com (1 deletion from google)", () => {
    const result = checkTyposquatting("gogle.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("google.com");
  });

  it("catches paypa1.com (l→1 homoglyph)", () => {
    const result = checkTyposquatting("paypa1.com");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("paypal.com");
  });

  it("does NOT flag exact trusted domains", () => {
    expect(checkTyposquatting("isbank.com.tr").isSuspicious).toBe(false);
    expect(checkTyposquatting("google.com").isSuspicious).toBe(false);
    expect(checkTyposquatting("turkiye.gov.tr").isSuspicious).toBe(false);
  });

  it("does NOT flag completely unrelated domains", () => {
    expect(checkTyposquatting("randomsite.com").isSuspicious).toBe(false);
    expect(checkTyposquatting("mywebsite.org").isSuspicious).toBe(false);
  });
});

// ─── FULL URL CHECK SCORING ──────────────────────────────────────
describe("Full URL scoring with improved detection", () => {
  it("TLD mismatch scores 60 → SUSPICIOUS at medium", () => {
    const result = checkUrl("https://turkiye.com", "medium");
    expect(result.score).toBe(60);
    expect(result.level).toBe(ThreatLevel.SUSPICIOUS);
    expect(result.reasons[0]).toContain("farkli uzanti");
  });

  it("TLD mismatch scores 60 → DANGEROUS at high (threshold 50)", () => {
    const result = checkUrl("https://turkiye.com", "high");
    expect(result.score).toBe(60);
    expect(result.level).toBe(ThreatLevel.DANGEROUS);
  });

  it("substring match (50) + keyword 'secure' (20) = 70 → DANGEROUS", () => {
    // "securegaranti" contains "garanti" → 50 points
    // domain contains "secure" keyword → 20 points
    // Total: 70 → DANGEROUS at medium threshold (70)
    const result = checkUrl("https://securegaranti.com.tr", "medium");
    expect(result.score).toBe(70);
    expect(result.level).toBe(ThreatLevel.DANGEROUS);
    expect(result.reasons).toHaveLength(2);
  });

  it("subdomain impersonation scores 65 → SUSPICIOUS at medium", () => {
    const result = checkUrl("https://garanti.evil.com", "medium");
    expect(result.score).toBe(65);
    expect(result.level).toBe(ThreatLevel.SUSPICIOUS);
  });

  it("classic edit-distance still scores 70 → DANGEROUS at medium", () => {
    const result = checkUrl("https://isbenk.com.tr", "medium");
    expect(result.score).toBe(70);
    expect(result.level).toBe(ThreatLevel.DANGEROUS);
  });
});
