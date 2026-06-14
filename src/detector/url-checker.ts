import { ThreatLevel, type ThreatResult, type ExtensionSettings } from "@/utils/types";
import { isBlacklisted } from "@/storage/list-cache";
import { usomBloomTest } from "@/blocklist/usom-updater";
import { hasDomain } from "@/blocklist/indexeddb-store";
import { isDynamicWhitelisted, isUgcDomain, getRiskyTld } from "@/blocklist/whitelist-updater";
import t from "@/i18n/tr";
import { canonicalizeUrl } from "@/detector/url-canonicalizer";

// ─── PUNYCODE DECODER (RFC 3492) ─────────────────────────────────
// Chrome converts IDN domains to punycode (е-devlet.com → xn--devlet-2of.com).
// We decode them back to Unicode so homoglyph detection can work.

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function decodeDigit(cp: number): number {
  if (cp >= 48 && cp <= 57) return cp - 22; // 0-9 → 26-35
  if (cp >= 65 && cp <= 90) return cp - 65;  // A-Z → 0-25
  if (cp >= 97 && cp <= 122) return cp - 97; // a-z → 0-25
  return BASE;
}

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) / 2) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function decodePunycodeLabel(encoded: string): string {
  const output: number[] = [];
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;

  const delimIndex = encoded.lastIndexOf("-");
  const basicLength = delimIndex < 0 ? 0 : delimIndex;

  for (let j = 0; j < basicLength; j++) {
    output.push(encoded.charCodeAt(j));
  }

  let inputPos = basicLength > 0 ? basicLength + 1 : 0;

  while (inputPos < encoded.length) {
    const oldi = i;
    let w = 1;

    for (let k = BASE; ; k += BASE) {
      if (inputPos >= encoded.length) break;
      const digit = decodeDigit(encoded.charCodeAt(inputPos++));
      if (digit >= BASE) break;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }

    const outLen = output.length + 1;
    bias = adapt(i - oldi, outLen, oldi === 0);
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

export function decodePunycodeDomain(domain: string): string {
  return domain
    .split(".")
    .map((label) =>
      label.startsWith("xn--") ? decodePunycodeLabel(label.slice(4)) : label,
    )
    .join(".");
}

// Brand-operated first-party auxiliary domains. These are legitimately
// owned and directly operated by the brand of another TRUSTED_DOMAINS
// entry — e.g. `microsoftonline.com` is Microsoft's auth endpoint. The
// name-containment rule in checkTyposquatting would otherwise flag them
// as "contains trusted name" because "microsoftonline" contains
// "microsoft". Explicitly trust them.
//
// IMPORTANT: only list domains where the entire root is directly served
// by the brand. User-hostable PaaS/CDN roots (azurewebsites.net,
// amazonaws.com, windows.net, googleusercontent.com) must NEVER appear
// here — they would silently whitelist attacker-controlled subdomains
// like `garantibank.azurewebsites.net`.
const BRAND_SUBDOMAINS: ReadonlySet<string> = new Set([
  // Microsoft — first-party auth / SaaS only
  "microsoftonline.com",
  "office.com",
  "office365.com",
  "sharepoint.com",
  "msauth.net",
  "msftauth.net",
  "microsoft365.com",
  // Google — first-party APIs and analytics (not user-content hosts)
  "googleapis.com",
  "gstatic.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googleadservices.com",
  // Apple
  "icloud-content.com",
  // Amazon — ad-system only (NOT amazonaws.com: customer hosted)
  "amazon-adsystem.com",
  // Meta
  "facebook.net",
  "fbcdn.net",
  "instagram.net",
  "whatsapp.net",
  // Cloudflare — first-party analytics / streaming
  "cloudflareinsights.com",
  "cloudflarestream.com",
]);

// Credential/payment-theft signals — strong indicator of phishing intent.
// Used to flag contains-trusted-name hits for ALL brand tiers.
const HIGH_RISK_KEYWORDS: ReadonlyArray<string> = [
  "giris", "dogrulama", "hesap", "odeme", "sifre", "parola", "aktivasyon", "online",
  "login", "secure", "verify", "auth", "signin", "banking", "payment", "destek"
];


const LOW_RISK_KEYWORDS: ReadonlyArray<string> = [
  "indirim",
];

// Combined set — used by the free-domain keyword score path (+20).
const SUSPICIOUS_KEYWORDS: ReadonlyArray<string> = [...HIGH_RISK_KEYWORDS, ...LOW_RISK_KEYWORDS];

const GENERIC_BRAND_NAMES: ReadonlySet<string> = new Set([
  "turkiye", "google", "microsoft", "apple", "amazon",
  "youtube", "facebook", "instagram", "twitter", "paypal",
  "netflix", "spotify",
]);

// Well-known trusted domains — phishing targets in Turkey + major global sites
const TRUSTED_DOMAINS = new Set([
  // Turkey — government
  "turkiye.gov.tr",
  "e-devlet.gov.tr",
  "ptt.gov.tr",
  "gib.gov.tr",
  "sgk.gov.tr",
  // Turkey — banks
  "ziraatbank.com.tr",
  "isbank.com.tr",
  "garanti.com.tr",
  "akbank.com.tr",
  "akbank.com",
  "yapikredi.com.tr",
  "halkbank.com.tr",
  "vakifbank.com.tr",
  "denizbank.com",
  // Turkey — e-commerce & cargo
  "trendyol.com",
  "hepsiburada.com",
  "n11.com",
  "sahibinden.com",
  "yurticikargo.com",
  "araskargo.com.tr",
  "mngkargo.com.tr",
  "sendeo.com.tr",
  "dhl.com.tr",
  // Turkey — retail & news (added to stop short-name typosquat FPs)
  "a101.com.tr",
  "bim.com.tr",
  "sok.com.tr",
  "migros.com.tr",
  "ntv.com.tr",
  "haberturk.com",
  "cnnturk.com",
  // Global — search & services
  "google.com",
  "google.com.tr",
  "youtube.com",
  "bing.com",
  "yahoo.com",
  "wikipedia.org",
  "github.com",
  "stackoverflow.com",
  // Global — social
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "reddit.com",
  "whatsapp.com",
  "telegram.org",
  "discord.com",
  // Global — email & cloud
  "gmail.com",
  "microsoft.com",
  "live.com",
  "outlook.com",
  "apple.com",
  "icloud.com",
  "amazon.com",
  "amazon.com.tr",
  // Global — other major
  "netflix.com",
  "spotify.com",
  "shopify.com",
  "paypal.com",
  "cloudflare.com",
]);

export { getBlacklistSize as getBlocklistSize } from "@/storage/list-cache";

export function extractDomain(url: string): string | null {
  return canonicalizeUrl(url).hostname;
}

export function extractRootDomain(hostname: string): string {
  const canonical = canonicalizeUrl(`https://${hostname}`);

  return canonical.registrableDomain ?? canonical.hostname ?? hostname.toLowerCase();
}

function getRootLabelCountFromCanonical(
  hostname: string,
  canonical: ReturnType<typeof canonicalizeUrl>,
): number {
  const root = canonical.registrableDomain ?? canonical.hostname ?? hostname.toLowerCase();

  return root.split(".").length;
}

function extractRootDomainPreservingLabels(
  hostname: string,
  canonical: ReturnType<typeof canonicalizeUrl>,
): string {
  const parts = hostname.toLowerCase().split(".");
  const rootLabelCount = getRootLabelCountFromCanonical(hostname, canonical);

  return parts.slice(-rootLabelCount).join(".");
}

function extractSubdomainPartsPreservingLabels(
  hostname: string,
  canonical: ReturnType<typeof canonicalizeUrl>,
): string[] {
  const parts = hostname.toLowerCase().split(".");
  const rootLabelCount = getRootLabelCountFromCanonical(hostname, canonical);

  return parts.length > rootLabelCount ? parts.slice(0, -rootLabelCount) : [];
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );

      // Damerau extension: transposition of two adjacent characters costs 1
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

// Common unicode confusables: Cyrillic/Greek/Latin lookalikes → Latin equivalents
const CONFUSABLES: Record<string, string> = {
  // Cyrillic lowercase
  "\u0430": "a", // Cyrillic а
  "\u0435": "e", // Cyrillic е
  "\u043E": "o", // Cyrillic о
  "\u0440": "p", // Cyrillic р
  "\u0441": "c", // Cyrillic с
  "\u0443": "y", // Cyrillic у
  "\u0445": "x", // Cyrillic х
  "\u0456": "i", // Cyrillic і
  "\u0455": "s", // Cyrillic ѕ
  "\u0458": "j", // Cyrillic ј
  "\u04BB": "h", // Cyrillic һ
  "\u0491": "r", // Cyrillic ґ (looks like r in some fonts)
  "\u043A": "k", // Cyrillic к
  "\u043C": "m", // Cyrillic м (lowercase)
  "\u043D": "h", // Cyrillic н (lowercase, looks like h)
  "\u0442": "t", // Cyrillic т (lowercase)
  "\u0432": "b", // Cyrillic в (lowercase, looks like b)
  "\u0434": "d", // Cyrillic д (in italic/some fonts)
  "\u0448": "w", // Cyrillic ш (looks like w in some fonts)
  "\u044C": "b", // Cyrillic ь (soft sign, resembles b)
  // Latin extended lookalikes
  "\u0261": "g", // Latin small script g
  "\u0501": "d", // Cyrillic ԁ
  "\u0185": "b", // Latin ƅ
  "\u01C3": "l", // Latin ǃ (click letter, looks like l)
  // Greek lowercase
  "\u03B1": "a", // Greek α
  "\u03BF": "o", // Greek ο
  "\u03B5": "e", // Greek ε
  "\u03B9": "i", // Greek ι
  "\u03BA": "k", // Greek κ
  "\u03BD": "v", // Greek ν
  "\u03C1": "p", // Greek ρ
  "\u03C4": "t", // Greek τ
  "\u03C5": "u", // Greek υ
  "\u03C9": "w", // Greek ω
  // Turkish
  "\u0131": "i", // Turkish dotless ı
};

export function normalizeHomoglyphs(input: string): string {
  let result = "";
  for (const char of input) {
    result += CONFUSABLES[char] ?? char;
  }
  return result;
}

// {0,o}→"0", {1,l,i}→"1", {5,s}→"5" — applied to both sides so direction doesn't matter.
// 8/b excluded — too many real brand names contain 'b'.
function normalizeDigitLetterConfusables(s: string): string {
  let result = "";
  for (const c of s) {
    if (c === "0" || c === "o") result += "0";
    else if (c === "1" || c === "l" || c === "i") result += "1";
    else if (c === "5" || c === "s") result += "5";
    else result += c;
  }
  return result;
}

function stripSeparators(name: string): string {
  return name.replace(/[-_.]/g, "");
}

function extractName(rootDomain: string): string {
  return rootDomain.split(".")[0];
}

type TyposquattingCandidate = { similarTo: string; reason: string; priority: number };

function pickBetter(
  current: TyposquattingCandidate | null,
  candidate: TyposquattingCandidate,
): TyposquattingCandidate {
  return !current || candidate.priority < current.priority ? candidate : current;
}

export function checkTyposquatting(
  domain: string,
  canonical?: ReturnType<typeof canonicalizeUrl>,
): { isSuspicious: boolean; similarTo: string | null; reason: string | null } {
  const decoded = decodePunycodeDomain(domain);
  const resolvedCanonical = canonical ?? canonicalizeUrl(`https://${decoded}`);
  const root = extractRootDomainPreservingLabels(decoded, resolvedCanonical);

  if (TRUSTED_DOMAINS.has(root)) {
    return { isSuspicious: false, similarTo: null, reason: null };
  }
  if (BRAND_SUBDOMAINS.has(root)) {
    return { isSuspicious: false, similarTo: null, reason: null };
  }

  const rawName = extractName(root);
  const normalizedName = normalizeHomoglyphs(rawName);
  const strippedName = stripSeparators(normalizedName);
  const hasHomoglyphs = rawName !== normalizedName || domain !== decoded;
  const digNormName = normalizeDigitLetterConfusables(strippedName);

  // Check all subdomain parts for trusted name hiding (e.g. garanti.evil.com)
  const allParts = extractSubdomainPartsPreservingLabels(decoded, resolvedCanonical);

  let best: TyposquattingCandidate | null = null;

  for (const trusted of TRUSTED_DOMAINS) {
    const trustedRoot = extractRootDomain(trusted);
    const trustedName = extractName(trustedRoot);
    const strippedTrustedName = stripSeparators(trustedName);

    if (root === trustedRoot) continue;
    if (strippedTrustedName.length <= 2) continue;

    if (normalizedName === trustedName || strippedName === strippedTrustedName) {
      if (hasHomoglyphs) {
        return { isSuspicious: true, similarTo: trusted, reason: "homoglyph" };
      }
      best = pickBetter(best, { similarTo: trusted, reason: "tld-mismatch", priority: 3 });
      continue;
    }

    const digNormTrusted = normalizeDigitLetterConfusables(strippedTrustedName);
    if (
      digNormName === digNormTrusted &&
      (digNormName !== strippedName || digNormTrusted !== strippedTrustedName)
    ) {
      return { isSuspicious: true, similarTo: trusted, reason: "homoglyph" };
    }

    const distance = levenshteinDistance(strippedName, strippedTrustedName);
    const lenDiff = Math.abs(strippedName.length - strippedTrustedName.length);
    const shortName = strippedTrustedName.length <= 4 || strippedName.length <= 4;
    const isDoubledCharAttack =
      distance === 2 && lenDiff === 2 &&
      /(.)\1/.test(strippedName) && strippedName.length > strippedTrustedName.length;
    if (!shortName && (distance === 1 || (distance === 2 && lenDiff === 1) || isDoubledCharAttack)) {
      best = pickBetter(best, {
        similarTo: trusted,
        reason: hasHomoglyphs ? "homoglyph" : "edit-distance",
        priority: 1,
      });
    }

    if (strippedTrustedName.length >= 5 && strippedName.length > strippedTrustedName.length) {
      if (strippedName.includes(strippedTrustedName)) {
        const hasHighRiskKeyword = HIGH_RISK_KEYWORDS.some((kw) => strippedName.includes(kw));
        const hasAnyKeyword = SUSPICIOUS_KEYWORDS.some((kw) => strippedName.includes(kw));
        const hasSeparator = rawName.includes("-");
        const ratio = strippedName.length / strippedTrustedName.length;
        const isGeneric = GENERIC_BRAND_NAMES.has(strippedTrustedName);

        // GENERIC brands (google, paypal …): any keyword or separator is
        // suspicious when the domain isn't too long (ratio < 2.0).
        // DEFAULT brands (garanti, akbank …): only HIGH-RISK keywords
        // (credential/payment-oriented) or a separator warrant flagging —
        // LOW-RISK words like "indirim" alone don't flag, because legitimate
        // discount portals (garantiliindirim.com, akbankindirim.com) use them.
        const shouldFlag = isGeneric
          ? (hasAnyKeyword || hasSeparator) && ratio < 2.0
          : hasHighRiskKeyword || hasSeparator;

        if (shouldFlag) {
          best = pickBetter(best, { similarTo: trusted, reason: "contains-trusted-name", priority: 4 });
        }
      }
    }

    for (const part of allParts) {
      const normalizedPart = normalizeHomoglyphs(part);
      if (normalizedPart === trustedName) {
        best = pickBetter(best, { similarTo: trusted, reason: "subdomain-impersonation", priority: 2 });
        break;
      }
      const partDistance = levenshteinDistance(normalizedPart, trustedName);
      if (trustedName.length >= 4 && partDistance > 0 && partDistance <= 2) {
        best = pickBetter(best, { similarTo: trusted, reason: "subdomain-typosquat", priority: 2 });
        break;
      }
    }
  }

  if (best !== null) {
    return { isSuspicious: true, similarTo: best.similarTo, reason: best.reason };
  }
  return { isSuspicious: false, similarTo: null, reason: null };
}

export function checkUrl(
  url: string,
  protectionLevel: ExtensionSettings["protectionLevel"] = "medium",
): ThreatResult {
  const canonical = canonicalizeUrl(url);
  const domain = canonical.hostname;
  const now = Date.now();

  if (!domain) {
    return {
      level: ThreatLevel.UNKNOWN,
      score: 0,
      reasons: [t.reasons.invalidUrl],
      url,
      checkedAt: now,
    };
  }

  const rootDomain = canonical.registrableDomain ?? domain;
  const reasons: string[] = [];
  let score = 0;

  // Check blocklist via IndexedDB-backed in-memory cache (all levels)
  if (isBlacklisted(domain) || isBlacklisted(rootDomain)) {
    score = 100;
    reasons.push(t.reasons.knownDangerous);
    return { level: ThreatLevel.DANGEROUS, score, reasons, url, checkedAt: now };
  }

  // Check USOM Bloom filter (sync, fast — "no" is definitive)
  if (usomBloomTest(domain) || usomBloomTest(rootDomain)) {
    score = 100;
    reasons.push(t.reasons.usomListed);
    return { level: ThreatLevel.DANGEROUS, score, reasons, url, checkedAt: now };
  }

  // Dynamic whitelist — skip further heuristics for known-safe domains
  if (isDynamicWhitelisted(rootDomain) && !isUgcDomain(domain)) {
    return { level: ThreatLevel.SAFE, score: 0, reasons: [], url, checkedAt: now };
  }

  // Low protection: only blocklist check — skip further analysis
  if (protectionLevel === "low") {
    if (TRUSTED_DOMAINS.has(rootDomain)) {
      return { level: ThreatLevel.SAFE, score: 0, reasons: [], url, checkedAt: now };
    }
    return { level: ThreatLevel.UNKNOWN, score: 0, reasons: [], url, checkedAt: now };
  }

  // Medium + High: typosquatting check
  const typo = checkTyposquatting(domain, canonical);
  if (typo.isSuspicious) {
    const reasonLabels: Record<string, { score: number; text: string }> = {
      "homoglyph": { score: 100, text: t.reasons.homoglyph },
      "edit-distance": { score: 70, text: t.reasons.editDistance },
      "tld-mismatch": { score: 60, text: t.reasons.tldMismatch },
      "contains-trusted-name": { score: 50, text: t.reasons.containsTrusted },
      "subdomain-impersonation": { score: 65, text: t.reasons.subdomainImpersonation },
      "subdomain-typosquat": { score: 55, text: t.reasons.subdomainTyposquat },
    };
    const match = reasonLabels[typo.reason ?? ""] ?? { score: 70, text: t.reasons.similarDomain };
    score += match.score;
    reasons.push(`${typo.similarTo} ile ${match.text}`);
  }

  if (SUSPICIOUS_KEYWORDS.some((kw) => domain.includes(kw))) {
    if (!TRUSTED_DOMAINS.has(rootDomain)) {
      score += 20;
      reasons.push(t.reasons.suspiciousKeyword);
    }
  }

  // Medium + High: IP-based URL check
  if (domain.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    score += 30;
    reasons.push(t.reasons.ipAccess);
  }

  // Medium + High: excessive subdomain check
  const subdomainCount = canonical.subdomain ? canonical.subdomain.split(".").length : 0;
  if (subdomainCount > 3) {
    score += 15;
    reasons.push(t.reasons.excessiveSubdomains);
  }

  // Medium + High: risky TLD check
  const riskyTld = getRiskyTld(domain);
  if (riskyTld) {
    score += 15;
    reasons.push(t.reasons.riskyTld(riskyTld));
  }

  // High protection: lower thresholds for more aggressive detection
  const dangerousThreshold = protectionLevel === "high" ? 50 : 70;
  const suspiciousThreshold = protectionLevel === "high" ? 15 : 30;

  // Determine threat level
  let level: ThreatLevel;
  if (score >= dangerousThreshold) {
    level = ThreatLevel.DANGEROUS;
  } else if (score >= suspiciousThreshold) {
    level = ThreatLevel.SUSPICIOUS;
  } else if (TRUSTED_DOMAINS.has(rootDomain)) {
    level = ThreatLevel.SAFE;
  } else {
    level = ThreatLevel.UNKNOWN;
  }

  return { level, score, reasons, url, checkedAt: now };
}

/**
 * Async version that confirms USOM Bloom filter hits against IndexedDB.
 * Use this when you need zero false positives (e.g. before showing a warning).
 */
export async function checkUrlConfirmed(
  url: string,
  protectionLevel: ExtensionSettings["protectionLevel"] = "medium",
): Promise<ThreatResult> {
  const result = checkUrl(url, protectionLevel);

  // If the sync check flagged it as USOM, confirm via IndexedDB
  if (result.level === ThreatLevel.DANGEROUS && result.reasons.includes(t.reasons.usomListed)) {
    const domain = extractDomain(url);
    if (domain) {
      const rootDomain = extractRootDomain(domain);
      const confirmed = await hasDomain(domain) || await hasDomain(rootDomain);
      if (!confirmed) {
        // Bloom filter false positive — re-run without USOM flag
        const filteredReasons = result.reasons.filter((r) => r !== t.reasons.usomListed);
        return {
          ...result,
          level: filteredReasons.length > 0 ? result.level : ThreatLevel.UNKNOWN,
          score: filteredReasons.length > 0 ? result.score : 0,
          reasons: filteredReasons,
        };
      }
    }
  }

  return result;
}
