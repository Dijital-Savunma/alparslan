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
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function extractName(rootDomain: string): string {
  // Extract just the name part: "isbank.com.tr" -> "isbank", "example.com" -> "example"
  return rootDomain.split(".")[0];
}

export function checkTyposquatting(domain: string): { isSuspicious: boolean; similarTo: string | null } {
  const root = extractRootDomain(domain);

  // If the domain itself is trusted, no typosquatting
  if (TRUSTED_DOMAINS.has(root)) {
    return { isSuspicious: false, similarTo: null };
  }

  const name = extractName(root);

  for (const trusted of TRUSTED_DOMAINS) {
    const trustedRoot = extractRootDomain(trusted);
    const trustedName = extractName(trustedRoot);

    if (root === trustedRoot) continue;

    const distance = levenshteinDistance(name, trustedName);
    // If very similar but not identical, it's suspicious
    if (distance > 0 && distance <= 2) {
      return { isSuspicious: true, similarTo: trusted };
    }
  }
  return { isSuspicious: false, similarTo: null };
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
    score += 70;
    reasons.push(`${typo.similarTo} ile benzer domain (olasi sahte site)`);
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
