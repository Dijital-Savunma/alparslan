// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache, getCache, setCache } from "@/api/usom/cache";
import { queryUsom } from "@/api/usom/client";
import { DB_NAME } from "@/api/usom/constants";
import { checkDomain } from "@/api/usom/service";
import type { DomainRecord } from "@/api/usom/types";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("USOM test database deletion was blocked"));
  });
}

function apiResponse(count: number) {
  return {
    totalCount: count,
    count,
    models:
      count > 0
        ? [
            {
              id: 1,
              url: "evil.example",
              type: "domain",
              desc: "Phishing",
              source: "USOM",
              date: "2026-06-19",
              criticality_level: 5,
              connectiontype: "domain",
            },
          ]
        : [],
    page: 1,
    pageCount: count > 0 ? 1 : 0,
  };
}

function mockJsonResponse(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

beforeEach(async () => {
  clearCache();
  vi.unstubAllGlobals();
  await deleteDatabase();
});

describe("USOM client", () => {
  it("encodes the query and maps a listed result", async () => {
    mockJsonResponse(apiResponse(1));

    const result = await queryUsom("evil.example");

    expect(result).toEqual({
      domain: "evil.example",
      verdict: true,
      desc: "Phishing",
      criticality: 5,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("q=evil.example");
  });

  it("rejects malformed API responses", async () => {
    mockJsonResponse({ count: "1", models: [] });

    await expect(queryUsom("example.com")).rejects.toThrow("invalid response");
  });
});

describe("USOM memory cache", () => {
  it("removes expired records when they are read", () => {
    const expired: DomainRecord = {
      domain: "expired.example",
      verdict: false,
      checkedAt: new Date(Date.now() - 2_000),
      expiresAt: new Date(Date.now() - 1_000),
    };

    setCache(expired);

    expect(getCache(expired.domain)).toBeNull();
  });
});

describe("USOM service", () => {
  it("normalizes domains and reuses the cached result", async () => {
    mockJsonResponse(apiResponse(0));

    const first = await checkDomain(" Example.COM. ");
    const second = await checkDomain("example.com");

    expect(first.domain).toBe("example.com");
    expect(first.verdict).toBe(false);
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent checks for the same domain", async () => {
    mockJsonResponse(apiResponse(1));

    const [first, second] = await Promise.all([
      checkDomain("evil.example"),
      checkDomain("evil.example"),
    ]);

    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns an error verdict when the API request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const result = await checkDomain("offline.example");

    expect(result.verdict).toBeNull();
    expect(result.expiresAt.getTime()).toBeGreaterThan(result.checkedAt.getTime());
  });

  it("rejects empty domain input", () => {
    expect(() => checkDomain(" ... ")).toThrow(TypeError);
  });
});
