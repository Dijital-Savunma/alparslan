// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  initListCache,
  isWhitelisted,
  isBlacklisted,
  addToWhitelist,
  removeFromWhitelist,
  addToBlacklist,
  removeFromBlacklist,
  getWhitelistDomains,
  getBlacklistSize,
  isCacheReady,
  resetListCache,
} from "@/storage/list-cache";
import { addWhitelistEntry, addBlacklistEntries, getDb, closeDb } from "@/storage/idb";
import type { BlacklistEntry } from "@/storage/types";

async function clearAllStores(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["whitelist", "blacklist", "metadata"], "readwrite");
  tx.objectStore("whitelist").clear();
  tx.objectStore("blacklist").clear();
  tx.objectStore("metadata").clear();
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
}

beforeEach(async () => {
  resetListCache();
  await clearAllStores();
});

describe("initListCache", () => {
  it("marks cache as ready after init", async () => {
    expect(isCacheReady()).toBe(false);
    await initListCache();
    expect(isCacheReady()).toBe(true);
  });

  it("loads existing data from IndexedDB", async () => {
    // Pre-populate IDB
    await addWhitelistEntry("safe.com", "user");
    await addBlacklistEntries([{ domain: "evil.com", category: "other", addedAt: "2026-01-01", source: "manual" }]);

    await initListCache();

    expect(isWhitelisted("safe.com")).toBe(true);
    expect(isBlacklisted("evil.com")).toBe(true);
  });
});

describe("isWhitelisted", () => {
  beforeEach(async () => {
    await initListCache();
    await addToWhitelist("example.com");
  });

  it("returns true for exact match", () => {
    expect(isWhitelisted("example.com")).toBe(true);
  });

  it("returns true for subdomain match", () => {
    expect(isWhitelisted("sub.example.com")).toBe(true);
  });

  it("returns false for unrelated domain", () => {
    expect(isWhitelisted("other.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isWhitelisted("EXAMPLE.COM")).toBe(true);
  });

  it("normalizes URL-shaped whitelist entries before matching", async () => {
    await addToWhitelist("https://www.example.com:8443/login?token=abc");

    expect(isWhitelisted("www.example.com")).toBe(true);
    expect(getWhitelistDomains()).toContain("www.example.com");
  });

  it("matches subdomains under private-suffix registrable domains only", async () => {
    await addToWhitelist("foo.github.io");

    expect(isWhitelisted("bar.foo.github.io")).toBe(true);
    expect(isWhitelisted("evil.github.io")).toBe(false);
  });

  it.each(["github.io", "pages.dev", "blogspot.com", "com.tr", "co.uk"])(
    "ignores public suffix whitelist entry %s",
    async (domain) => {
      await addToWhitelist(domain);

      expect(isWhitelisted(`evil.${domain}`)).toBe(false);
      expect(getWhitelistDomains()).not.toContain(domain);
    },
  );
});

describe("isBlacklisted", () => {
  beforeEach(async () => {
    await initListCache();
    await addToBlacklist([{ domain: "phish.com", category: "other", addedAt: "2026-01-01", source: "manual" }]);
  });

  it("returns true for exact match", () => {
    expect(isBlacklisted("phish.com")).toBe(true);
  });

  it("returns true for subdomain match", () => {
    expect(isBlacklisted("sub.phish.com")).toBe(true);
  });

  it("returns false for unrelated domain", () => {
    expect(isBlacklisted("safe.com")).toBe(false);
  });

  it("normalizes URL-shaped blacklist entries before matching", async () => {
    await addToBlacklist([
      {
        domain: "https://login.phish.com:8443/account?token=abc",
        category: "other",
        addedAt: "2026-01-01",
        source: "manual",
      },
    ]);

    expect(isBlacklisted("login.phish.com")).toBe(true);
    expect(isBlacklisted("safe.com")).toBe(false);
  });

  it("does not overmatch sibling private-suffix tenants", async () => {
    await addToBlacklist([
      { domain: "foo.github.io", category: "other", addedAt: "2026-01-01", source: "manual" },
    ]);

    expect(isBlacklisted("bar.foo.github.io")).toBe(true);
    expect(isBlacklisted("evil.github.io")).toBe(false);
  });
});

describe("write-through mutations", () => {
  beforeEach(async () => {
    await initListCache();
  });

  it("addToWhitelist updates memory and IDB", async () => {
    await addToWhitelist("new.com");
    expect(isWhitelisted("new.com")).toBe(true);
    expect(getWhitelistDomains()).toContain("new.com");
  });

  it("removeFromWhitelist removes from memory and IDB", async () => {
    await addToWhitelist("temp.com");
    await removeFromWhitelist("temp.com");
    expect(isWhitelisted("temp.com")).toBe(false);
  });

  it("addToBlacklist updates memory and IDB", async () => {
    const entries: BlacklistEntry[] = [
      { domain: "bad1.com", category: "other", addedAt: "2026-01-01", source: "manual" },
      { domain: "bad2.com", category: "bank", addedAt: "2026-01-01", source: "manual" },
    ];
    await addToBlacklist(entries);
    expect(isBlacklisted("bad1.com")).toBe(true);
    expect(isBlacklisted("bad2.com")).toBe(true);
    expect(getBlacklistSize()).toBe(2);
  });

  it("removeFromBlacklist removes from memory and IDB", async () => {
    await addToBlacklist([{ domain: "temp-evil.com", category: "other", addedAt: "2026-01-01", source: "manual" }]);
    await removeFromBlacklist("temp-evil.com");
    expect(isBlacklisted("temp-evil.com")).toBe(false);
  });
});
