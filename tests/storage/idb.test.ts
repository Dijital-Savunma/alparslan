// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getDb,
  getAllWhitelist,
  addWhitelistEntry,
  removeWhitelistEntry,
  getAllBlacklist,
  addBlacklistEntries,
  replaceBlacklist,
  removeBlacklistEntry,
  getMetadata,
  setMetadata,
  closeDb,
} from "@/storage/idb";
import type { BlacklistEntry } from "@/storage/types";

beforeEach(async () => {
  const db = await getDb();
  const tx = db.transaction(["whitelist", "blacklist", "metadata"], "readwrite");
  tx.objectStore("whitelist").clear();
  tx.objectStore("blacklist").clear();
  tx.objectStore("metadata").clear();
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
});

describe("getDb", () => {
  it("opens database and creates object stores", async () => {
    const db = await getDb();
    expect(db.name).toBe("AlparslanDB");
    expect(db.objectStoreNames.contains("whitelist")).toBe(true);
    expect(db.objectStoreNames.contains("blacklist")).toBe(true);
    expect(db.objectStoreNames.contains("metadata")).toBe(true);
  });

  it("returns same instance on second call", async () => {
    const db1 = await getDb();
    const db2 = await getDb();
    expect(db1).toBe(db2);
  });
});

describe("whitelist operations", () => {
  it("adds and retrieves whitelist entries", async () => {
    await addWhitelistEntry("example.com", "user");
    await addWhitelistEntry("test.org", "import");

    const entries = await getAllWhitelist();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.domain)).toContain("example.com");
    expect(entries.map((e) => e.domain)).toContain("test.org");
  });

  it("lowercases domains", async () => {
    await addWhitelistEntry("Example.COM", "user");
    const entries = await getAllWhitelist();
    expect(entries[0].domain).toBe("example.com");
  });

  it("removes whitelist entries", async () => {
    await addWhitelistEntry("example.com", "user");
    await addWhitelistEntry("test.org", "user");
    await removeWhitelistEntry("example.com");

    const entries = await getAllWhitelist();
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe("test.org");
  });

  it("upserts on duplicate domain", async () => {
    await addWhitelistEntry("example.com", "user");
    await addWhitelistEntry("example.com", "import");

    const entries = await getAllWhitelist();
    expect(entries).toHaveLength(1);
    expect(entries[0].addedBy).toBe("import");
  });
});

describe("blacklist operations", () => {
  const testEntries: BlacklistEntry[] = [
    { domain: "evil.com", category: "other", addedAt: "2026-01-01", source: "manual" },
    { domain: "phish.bank.tr", category: "bank", addedAt: "2026-01-02", source: "builtin" },
  ];

  it("adds and retrieves blacklist entries", async () => {
    await addBlacklistEntries(testEntries);
    const entries = await getAllBlacklist();
    expect(entries).toHaveLength(2);
  });

  it("replaces blacklist entirely", async () => {
    await addBlacklistEntries(testEntries);
    await replaceBlacklist([{ domain: "new-evil.com", category: "other", addedAt: "2026-02-01", source: "remote" }]);

    const entries = await getAllBlacklist();
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe("new-evil.com");
  });

  it("removes single blacklist entry", async () => {
    await addBlacklistEntries(testEntries);
    await removeBlacklistEntry("evil.com");

    const entries = await getAllBlacklist();
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe("phish.bank.tr");
  });
});

describe("metadata operations", () => {
  it("sets and gets metadata", async () => {
    await setMetadata("migrationV1Complete", true);
    const value = await getMetadata("migrationV1Complete");
    expect(value).toBe(true);
  });

  it("returns null for missing key", async () => {
    const value = await getMetadata("nonexistent");
    expect(value).toBeNull();
  });

  it("updates existing metadata", async () => {
    await setMetadata("version", 1);
    await setMetadata("version", 2);
    const value = await getMetadata("version");
    expect(value).toBe(2);
  });
});
