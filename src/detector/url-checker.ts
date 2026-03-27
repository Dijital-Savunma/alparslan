import { ThreatLevel, type ThreatResult, type ExtensionSettings } from "@/utils/types";

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
  "afrfrgo.com.tr",
  "mngkargo.com.tr",
  "sendeo.com.tr",
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
  "paypal.com",
  "cloudflare.com",
]);

let dangerousDomains: Set<string> = new Set();

export function loadBlocklist(domains: string[], replace = false): void {
  if (replace) {
    dangerousDomains = new Set(domains.map((d) => d.toLowerCase()));
  } else {
    for (const d of domains) {
      dangerousDomains.add(d.toLowerCase());
    }
  }
}

export function getBlocklistSize(): number {
  return dangerousDomains.size;
}

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;

  // Handle .com.tr, .gov.tr, .org.tr etc.
  const secondLevel = parts[parts.length - 2];
  if (["com", "gov", "org", "edu", "net", "mil"].includes(secondLevel) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
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

// Common unicode confusables: Cyrillic/Greek lookalikes → Latin equivalents
const CONFUSABLES: Record<string, string> = {
  "\u0430": "a", // Cyrillic а
  "\u0435": "e", // Cyrillic е
  "\u043E": "o", // Cyrillic о
  "\u0440": "p", // Cyrillic р
  "\u0441": "c", // Cyrillic с
  "\u0443": "y", // Cyrillic у
  "\u0445": "x", // Cyrillic х
  "\u0456": "i", // Cyrillic і
  "\u0261": "g", // Latin small script g
  "\u03B1": "a", // Greek α
  "\u03BF": "o", // Greek ο
  "\u03B5": "e", // Greek ε
  "\u0131": "i", // Turkish dotless ı
};

export function normalizeHomoglyphs(input: string): string {
  let result = "";
  for (const char of input) {
    result += CONFUSABLES[char] ?? char;
  }
  return result;
}

function stripSeparators(name: string): string {
  return name.replace(/[-_.]/g, "");
}

function extractName(rootDomain: string): string {
  // Extract just the name part: "isbank.com.tr" -> "isbank", "example.com" -> "example"
  return rootDomain.split(".")[0];
}

export function checkTyposquatting(
  domain: string,
): { isSuspicious: boolean; similarTo: string | null; reason: string | null } {
  const root = extractRootDomain(domain);

  // If the domain itself is trusted, no typosquatting
  if (TRUSTED_DOMAINS.has(root)) {
    return { isSuspicious: false, similarTo: null, reason: null };
  }

  const rawName = extractName(root);
  const normalizedName = normalizeHomoglyphs(rawName);
  const strippedName = stripSeparators(normalizedName);

  // Check all subdomain parts for trusted name hiding (e.g. garanti.evil.com)
  const subdomainParts = domain.split(".");
  const allParts = subdomainParts.length > 2 ? subdomainParts.slice(0, -2) : [];

  for (const trusted of TRUSTED_DOMAINS) {
    const trustedRoot = extractRootDomain(trusted);
    const trustedName = extractName(trustedRoot);

    if (root === trustedRoot) continue;

    // Skip very short trusted names (≤2 chars) to avoid false positives
    if (trustedName.length <= 2) continue;

    // Check 1: Same name but different TLD (turkiye.com vs turkiye.gov.tr)
    if (normalizedName === trustedName || strippedName === trustedName) {
      return {
        isSuspicious: true,
        similarTo: trusted,
        reason: "tld-mismatch",
      };
    }

    // Check 2: Damerau-Levenshtein distance ≤ 2 (classic typosquatting)
    const distance = levenshteinDistance(strippedName, trustedName);
    if (distance > 0 && distance <= 2) {
      return {
        isSuspicious: true,
        similarTo: trusted,
        reason: "edit-distance",
      };
    }

    // Check 3: Trusted name contained as substring (securegaranti.com.tr)
    // Only for names long enough to avoid false positives (≥5 chars)
    if (trustedName.length >= 5 && strippedName.length > trustedName.length) {
      if (strippedName.includes(trustedName)) {
        return {
          isSuspicious: true,
          similarTo: trusted,
          reason: "contains-trusted-name",
        };
      }
    }

    // Check 4: Subdomain hiding (garanti.evil.com, isbank.phishing.net)
    for (const part of allParts) {
      const normalizedPart = normalizeHomoglyphs(part);
      if (normalizedPart === trustedName) {
        return {
          isSuspicious: true,
          similarTo: trusted,
          reason: "subdomain-impersonation",
        };
      }
      const partDistance = levenshteinDistance(normalizedPart, trustedName);
      if (trustedName.length >= 4 && partDistance > 0 && partDistance <= 2) {
        return {
          isSuspicious: true,
          similarTo: trusted,
          reason: "subdomain-typosquat",
        };
      }
    }
  }
  return { isSuspicious: false, similarTo: null, reason: null };
}

export function checkUrl(
  url: string,
  protectionLevel: ExtensionSettings["protectionLevel"] = "medium",
): ThreatResult {
  const domain = extractDomain(url);
  const now = Date.now();

  if (!domain) {
    return {
      level: ThreatLevel.UNKNOWN,
      score: 0,
      reasons: ["Gecersiz URL"],
      url,
      checkedAt: now,
    };
  }

  const rootDomain = extractRootDomain(domain);
  const reasons: string[] = [];
  let score = 0;

  // Check blocklist (all levels)
  if (dangerousDomains.has(domain) || dangerousDomains.has(rootDomain)) {
    score = 100;
    reasons.push("Bilinen tehlikeli site");
    return { level: ThreatLevel.DANGEROUS, score, reasons, url, checkedAt: now };
  }

  // Low protection: only blocklist check — skip further analysis
  if (protectionLevel === "low") {
    if (TRUSTED_DOMAINS.has(rootDomain)) {
      return { level: ThreatLevel.SAFE, score: 0, reasons: [], url, checkedAt: now };
    }
    return { level: ThreatLevel.UNKNOWN, score: 0, reasons: [], url, checkedAt: now };
  }

  // Medium + High: typosquatting check
  const typo = checkTyposquatting(domain);
  if (typo.isSuspicious) {
    const reasonLabels: Record<string, { score: number; text: string }> = {
      "edit-distance": { score: 70, text: "benzer domain (olasi sahte site)" },
      "tld-mismatch": { score: 60, text: "ayni isim farkli uzanti (olasi sahte site)" },
      "contains-trusted-name": { score: 50, text: "guvenilir ismi iceriyor (olasi sahte site)" },
      "subdomain-impersonation": { score: 65, text: "alt alan adinda guvenilir isim (olasi sahte site)" },
      "subdomain-typosquat": { score: 55, text: "alt alan adinda benzer isim (olasi sahte site)" },
    };
    const match = reasonLabels[typo.reason ?? ""] ?? { score: 70, text: "benzer domain" };
    score += match.score;
    reasons.push(`${typo.similarTo} ile ${match.text}`);
  }

  // Medium + High: suspicious keyword check
  if (domain.includes("login") || domain.includes("secure") || domain.includes("verify")) {
    if (!TRUSTED_DOMAINS.has(rootDomain)) {
      score += 20;
      reasons.push("Suppheli anahtar kelime iceriyor");
    }
  }

  // Medium + High: IP-based URL check
  if (domain.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    score += 30;
    reasons.push("IP adresi ile erisim");
  }

  // Medium + High: excessive subdomain check
  const subdomainCount = domain.split(".").length;
  if (subdomainCount > 4) {
    score += 15;
    reasons.push("Cok fazla alt alan adi");
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
