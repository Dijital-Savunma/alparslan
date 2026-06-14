import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkUrl,
  extractDomain,
  extractRootDomain,
  levenshteinDistance,
  checkTyposquatting,
} from "@/detector/url-checker";
import { ThreatLevel } from "@/utils/types";
import t from "@/i18n/tr";
import { initListCache, addToBlacklist, resetListCache } from "@/storage/list-cache";
import { getDb } from "@/storage/idb";

describe("extractDomain", () => {
  it("should extract domain from valid URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("www.example.com");
  });

  it("should lowercase the domain", () => {
    expect(extractDomain("https://WWW.EXAMPLE.COM")).toBe("www.example.com");
  });

  it("should return null for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBeNull();
  });

  it("should handle URLs with ports", () => {
    expect(extractDomain("https://example.com:8080/path")).toBe("example.com");
  });
});

describe("extractRootDomain", () => {
  it("should extract root domain from simple hostname", () => {
    expect(extractRootDomain("example.com")).toBe("example.com");
  });

  it("should handle subdomains", () => {
    expect(extractRootDomain("www.example.com")).toBe("example.com");
  });

  it("should handle .com.tr domains", () => {
    expect(extractRootDomain("www.isbank.com.tr")).toBe("isbank.com.tr");
  });

  it("should handle .gov.tr domains", () => {
    expect(extractRootDomain("www.turkiye.gov.tr")).toBe("turkiye.gov.tr");
  });

  it("should handle private suffix domains", () => {
    expect(extractRootDomain("foo.github.io")).toBe("foo.github.io");
    expect(extractRootDomain("bar.foo.github.io")).toBe("foo.github.io");
  });
});

describe("levenshteinDistance", () => {
  it("should return 0 for identical strings", () => {
    expect(levenshteinDistance("test", "test")).toBe(0);
  });

  it("should return correct distance for single char change", () => {
    expect(levenshteinDistance("isbank", "isbenk")).toBe(1);
  });

  it("should return correct distance for substitution", () => {
    expect(levenshteinDistance("paypal", "paypa1")).toBe(1);
  });

  it("should handle empty strings", () => {
    expect(levenshteinDistance("", "test")).toBe(4);
    expect(levenshteinDistance("test", "")).toBe(4);
  });
});

describe("checkTyposquatting", () => {
  it("should detect similar domain to trusted one", () => {
    const result = checkTyposquatting("isbenk.com.tr");
    expect(result.isSuspicious).toBe(true);
    expect(result.similarTo).toBe("isbank.com.tr");
  });

  it("should not flag exact trusted domains", () => {
    const result = checkTyposquatting("isbank.com.tr");
    expect(result.isSuspicious).toBe(false);
  });

  it("should not flag completely different domains", () => {
    const result = checkTyposquatting("randomsite.com");
    expect(result.isSuspicious).toBe(false);
  });

  it("should detect trusted-name hiding across canonical subdomain boundaries", () => {
    const result = checkTyposquatting("garanti.evil.com");

    expect(result.isSuspicious).toBe(true);
    expect(result.reason).toBe("subdomain-impersonation");
  });
});

describe("checkUrl", () => {
  beforeEach(async () => {
    resetListCache();
    const db = await getDb();
    const tx = db.transaction(["whitelist", "blacklist", "metadata"], "readwrite");
    tx.objectStore("whitelist").clear();
    tx.objectStore("blacklist").clear();
    tx.objectStore("metadata").clear();
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    await initListCache();
  });

  it("should return UNKNOWN for invalid URL", () => {
    const result = checkUrl("not-a-url");
    expect(result.level).toBe(ThreatLevel.UNKNOWN);
    expect(result.reasons).toContain(t.reasons.invalidUrl);
  });

  it("should return SAFE for trusted domains", () => {
    const result = checkUrl("https://turkiye.gov.tr/login");
    expect(result.level).toBe(ThreatLevel.SAFE);
    expect(result.score).toBe(0);
  });

  it("should return DANGEROUS for blocklisted domains", async () => {
    await addToBlacklist([{ domain: "evil-phishing.com", category: "other", addedAt: "2026-01-01", source: "manual" }]);
    const result = checkUrl("https://evil-phishing.com/login");
    expect(result.level).toBe(ThreatLevel.DANGEROUS);
    expect(result.score).toBe(100);
  });

  it("should detect typosquatting as DANGEROUS", () => {
    const result = checkUrl("https://isbenk.com.tr/login");
    expect(result.level).toBe(ThreatLevel.DANGEROUS);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("should flag IP-based URLs as SUSPICIOUS", () => {
    const result = checkUrl("http://192.168.1.1/phishing");
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  describe("excessive subdomain threshold (> 3 labels)", () => {
    it("3 subdomain labels — must NOT trigger excessive-subdomain warning", () => {
      // a.b.c  → canonical.subdomain = "a.b.c" → 3 labels, threshold is > 3 → no flag
      const result = checkUrl("https://a.b.c.example.com");
      expect(result.reasons.some((r) => r.includes("alt alan"))).toBe(false);
      expect(result.level).not.toBe(ThreatLevel.SUSPICIOUS);
    });

    it("4 subdomain labels — must trigger excessive-subdomain warning", () => {
      // a.b.c.d → canonical.subdomain = "a.b.c.d" → 4 labels, threshold is > 3 → flag
      const result = checkUrl("https://a.b.c.d.example.com");
      expect(result.reasons.some((r) => r.includes("alt alan"))).toBe(true);
    });

    it("5+ subdomain labels — also triggers (existing smoke test)", () => {
      const result = checkUrl("https://a.b.c.d.e.example.com");
      expect(result.reasons.some((r) => r.includes("alt alan"))).toBe(true);
    });
  });

  it("should flag suspicious keywords in domain", () => {
    const result = checkUrl("https://secure-login-verify.xyz");
    expect(result.reasons.some((r) => r.includes("anahtar kelime"))).toBe(true);
  });

  it.each([
    [
      "https://akbank.com.tr.evil.com/login",
      ThreatLevel.SUSPICIOUS,
      55,
      t.reasons.subdomainTyposquat, // "alt alan adında benzer isim"
    ],
    [
      "https://login-akbank.com/",
      ThreatLevel.DANGEROUS,
      70,
      t.reasons.containsTrusted, // "güvenilir ismi içeriyor"
    ],
    [
      "https://akbank-secure.com/",
      ThreatLevel.DANGEROUS,
      70,
      t.reasons.containsTrusted, // "güvenilir ismi içeriyor"
    ],
  ])(
    "should flag regression corpus phishing URL %s",
    (url, level, score, reasonFragment) => {
      const result = checkUrl(url);

      expect(result.level).toBe(level);
      expect(result.score).toBeGreaterThanOrEqual(score);
      expect(result.reasons.some((r) => r.includes(reasonFragment))).toBe(true);
    },
  );

  it("should include timestamp in result", () => {
    const before = Date.now();
    const result = checkUrl("https://example.com");
    expect(result.checkedAt).toBeGreaterThanOrEqual(before);
  });

  it("should return UNKNOWN for unknown but not suspicious domains", () => {
    const result = checkUrl("https://some-random-site.org");
    expect(result.level).toBe(ThreatLevel.UNKNOWN);
    expect(result.score).toBe(0);
  });

  describe("protection levels", () => {
    it("low: should only check blocklist", async () => {
      await addToBlacklist([{ domain: "evil.com", category: "other", addedAt: "2026-01-01", source: "manual" }]);
      // Blocklist still works
      const blocked = checkUrl("https://evil.com", "low");
      expect(blocked.level).toBe(ThreatLevel.DANGEROUS);

      // Typosquatting NOT detected in low mode
      const typo = checkUrl("https://isbenk.com.tr/login", "low");
      expect(typo.level).not.toBe(ThreatLevel.DANGEROUS);
      expect(typo.score).toBe(0);
    });

    it("low: should return SAFE for trusted domains", () => {
      const result = checkUrl("https://turkiye.gov.tr", "low");
      expect(result.level).toBe(ThreatLevel.SAFE);
    });

    it("medium: should detect typosquatting and keywords", () => {
      const result = checkUrl("https://isbenk.com.tr", "medium");
      expect(result.level).toBe(ThreatLevel.DANGEROUS);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it("high: should use lower thresholds", () => {
      // Keywords alone: score 20, medium threshold 30 = UNKNOWN, high threshold 15 = SUSPICIOUS
      const medKeyword = checkUrl("https://secure-login.xyz", "medium");
      const highKeyword = checkUrl("https://secure-login.xyz", "high");
      expect(medKeyword.level).toBe(ThreatLevel.UNKNOWN);
      expect(highKeyword.level).toBe(ThreatLevel.SUSPICIOUS);
    });
  });
});
