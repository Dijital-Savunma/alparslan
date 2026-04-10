// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCachedResult,
  setCachedResult,
  clearExpired,
  clearCache,
  getCacheSize,
  setTtlMinutes,
} from "@/network/url-check-cache";
import { ThreatLevel, type ThreatResult } from "@/utils/types";

const makeResult = (level: ThreatLevel = ThreatLevel.SAFE): ThreatResult => ({
  level,
  score: 0,
  reasons: [],
  url: "https://test.com",
  checkedAt: Date.now(),
});

beforeEach(() => {
  clearCache();
  setTtlMinutes(5); // reset to default
});

describe("getCachedResult / setCachedResult", () => {
  it("returns null for uncached domain", () => {
    expect(getCachedResult("unknown.com")).toBeNull();
  });

  it("returns cached result for known domain", () => {
    const result = makeResult(ThreatLevel.DANGEROUS);
    setCachedResult("evil.com", result);
    expect(getCachedResult("evil.com")).toEqual(result);
  });

  it("is case-insensitive", () => {
    setCachedResult("Example.COM", makeResult());
    expect(getCachedResult("example.com")).not.toBeNull();
  });
});

describe("TTL expiry", () => {
  it("returns null for expired entries", () => {
    setCachedResult("old.com", makeResult());

    // Advance time past TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes > 5 min TTL

    expect(getCachedResult("old.com")).toBeNull();
    vi.useRealTimers();
  });

  it("respects custom TTL", () => {
    setTtlMinutes(1); // 1 minute
    setCachedResult("short-ttl.com", makeResult());

    vi.useFakeTimers();
    vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes > 1 min TTL

    expect(getCachedResult("short-ttl.com")).toBeNull();
    vi.useRealTimers();
  });
});

describe("clearExpired", () => {
  it("removes expired entries", () => {
    setCachedResult("a.com", makeResult());
    setCachedResult("b.com", makeResult());
    expect(getCacheSize()).toBe(2);

    // Set TTL to 0 so everything expires, then clear
    setTtlMinutes(0);
    clearExpired();
    expect(getCacheSize()).toBe(0);
  });
});

describe("clearCache", () => {
  it("removes all entries", () => {
    setCachedResult("a.com", makeResult());
    setCachedResult("b.com", makeResult());
    expect(getCacheSize()).toBe(2);

    clearCache();
    expect(getCacheSize()).toBe(0);
  });
});
