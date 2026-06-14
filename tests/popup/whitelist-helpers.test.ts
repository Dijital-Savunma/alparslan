// Pure functions — no DOM/chrome APIs touched.
// @vitest-environment node

import { describe, it, expect } from "vitest";
import {
  normalizeQuickWhitelistDomain,
  isDomainInWhitelist,
} from "@/popup/whitelist-helpers";

describe("normalizeQuickWhitelistDomain", () => {
  describe("strips www prefix", () => {
    it.each([
      ["www.example.com", "example.com"],
      ["WWW.EXAMPLE.COM", "example.com"],
      ["www.garanti.com.tr", "garanti.com.tr"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeQuickWhitelistDomain(input)).toBe(expected);
    });
  });

  describe("strips protocol", () => {
    it.each([
      ["http://example.com", "example.com"],
      ["https://example.com", "example.com"],
      ["https://www.example.com", "example.com"],
      ["https://www.example.com/", "example.com"],
      ["https://www.example.com:8443/login?token=abc", "example.com"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeQuickWhitelistDomain(input)).toBe(expected);
    });
  });

  describe("strips path / query / fragment", () => {
    it.each([
      ["example.com/", "example.com"],
      ["example.com/login", "example.com"],
      ["example.com/login?token=abc", "example.com"],
      ["https://example.com/path/to/page", "example.com"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeQuickWhitelistDomain(input)).toBe(expected);
    });
  });

  describe("lowercases", () => {
    it.each([
      ["Example.COM", "example.com"],
      ["GARANTI.COM.TR", "garanti.com.tr"],
      ["MixedCase.Org", "mixedcase.org"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeQuickWhitelistDomain(input)).toBe(expected);
    });
  });

  describe("trims whitespace", () => {
    it.each([
      ["  example.com  ", "example.com"],
      ["\texample.com\n", "example.com"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeQuickWhitelistDomain(input)).toBe(expected);
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(normalizeQuickWhitelistDomain("")).toBe("");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(normalizeQuickWhitelistDomain("   ")).toBe("");
    });

    it("handles null/undefined-ish input safely", () => {
      // The function coerces via String(value || "") so falsy inputs become ""
      expect(normalizeQuickWhitelistDomain(null as unknown as string)).toBe("");
      expect(normalizeQuickWhitelistDomain(undefined as unknown as string)).toBe("");
    });

    it("preserves multi-segment TLDs after www strip", () => {
      expect(normalizeQuickWhitelistDomain("www.akbank.com.tr")).toBe("akbank.com.tr");
    });

    it("preserves private-suffix registrable domains after URL parsing", () => {
      expect(normalizeQuickWhitelistDomain("https://foo.github.io/path")).toBe("foo.github.io");
    });

    it("only strips the FIRST www, leaves www in middle of host", () => {
      // Pathological but defensive: an attacker can't sneak a bare host past
      // us by embedding "www." mid-string.
      expect(normalizeQuickWhitelistDomain("notwww.example.com")).toBe("notwww.example.com");
    });
  });
});

describe("isDomainInWhitelist", () => {
  describe("exact matches", () => {
    it("matches identical domain", () => {
      expect(isDomainInWhitelist("example.com", ["example.com"])).toBe(true);
    });

    it("matches when one of many entries equals domain", () => {
      expect(
        isDomainInWhitelist("example.com", ["foo.com", "example.com", "bar.com"]),
      ).toBe(true);
    });
  });

  describe("subdomain matches", () => {
    it("matches single-level subdomain", () => {
      expect(isDomainInWhitelist("api.example.com", ["example.com"])).toBe(true);
    });

    it("matches deeper subdomain", () => {
      expect(isDomainInWhitelist("v2.api.example.com", ["example.com"])).toBe(true);
    });

    it("matches multi-segment TLD subdomain", () => {
      expect(isDomainInWhitelist("mobile.akbank.com.tr", ["akbank.com.tr"])).toBe(true);
    });

    it("matches only within the same private-suffix registrable domain", () => {
      expect(isDomainInWhitelist("bar.foo.github.io", ["foo.github.io"])).toBe(true);
      expect(isDomainInWhitelist("evil.github.io", ["foo.github.io"])).toBe(false);
    });
  });

  describe("non-matches", () => {
    it("returns false for unrelated domain", () => {
      expect(isDomainInWhitelist("evil.com", ["example.com"])).toBe(false);
    });

    it("returns false for empty whitelist", () => {
      expect(isDomainInWhitelist("example.com", [])).toBe(false);
    });

    it("does NOT match a domain that merely ends with the same letters", () => {
      // "fakeexample.com" ends with "example.com" as a substring but not as
      // a subdomain — the leading "." in the check prevents this match.
      expect(isDomainInWhitelist("fakeexample.com", ["example.com"])).toBe(false);
    });

    it("does NOT match parent of whitelist entry", () => {
      // "example.com" is NOT a subdomain of "api.example.com"
      expect(isDomainInWhitelist("example.com", ["api.example.com"])).toBe(false);
    });

    it("does NOT match sibling subdomain", () => {
      // "api.other.com" should not match whitelist entry "api.example.com"
      expect(isDomainInWhitelist("api.other.com", ["api.example.com"])).toBe(false);
    });
  });

  describe("realistic Turkish bank scenarios", () => {
    it("whitelisting akbank.com.tr matches mobile subdomain", () => {
      expect(isDomainInWhitelist("mobil.akbank.com.tr", ["akbank.com.tr"])).toBe(true);
    });

    it("whitelisting garanti.com.tr does not match fake-garanti.com", () => {
      expect(
        isDomainInWhitelist("fake-garanti.com", ["garanti.com.tr"]),
      ).toBe(false);
    });

    it("whitelisting garantibbva.com.tr does not match garanti.com.tr", () => {
      // Defensive: two real brands that share a prefix must not cross-match
      expect(
        isDomainInWhitelist("garantibbva.com.tr", ["garanti.com.tr"]),
      ).toBe(false);
    });
  });
});
