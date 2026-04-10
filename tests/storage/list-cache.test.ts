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
