import type { BlacklistEntry } from "./types";
import { logger } from "@/utils/logger";
import {
  getAllWhitelist,
  getAllBlacklist,
  addWhitelistEntry as idbAddWhitelist,
  removeWhitelistEntry as idbRemoveWhitelist,
  addBlacklistEntries as idbAddBlacklist,
  replaceBlacklist as idbReplaceBlacklist,
  removeBlacklistEntry as idbRemoveBlacklist,
  getMetadata,
  setMetadata,
} from "./idb";

let whitelistSet = new Set<string>();
let blacklistSet = new Set<string>();
let cacheReady = false;

export function isCacheReady(): boolean {
  return cacheReady;
}

// --- Sync lookups (O(1), used on hot path) ---

export function isWhitelisted(domain: string): boolean {
  const d = domain.toLowerCase();
  if (whitelistSet.has(d)) return true;
  // Check parent domain match (e.g. "sub.example.com" matches "example.com")
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (whitelistSet.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

export function isBlacklisted(domain: string): boolean {
  const d = domain.toLowerCase();
  if (blacklistSet.has(d)) return true;
  // Check root domain
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (blacklistSet.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

// --- Write-through mutations ---

export async function addToWhitelist(domain: string): Promise<void> {
  const d = domain.toLowerCase();
  whitelistSet.add(d);
  await idbAddWhitelist(d, "user");
}

export async function removeFromWhitelist(domain: string): Promise<void> {
  const d = domain.toLowerCase();
  whitelistSet.delete(d);
  await idbRemoveWhitelist(d);
}

export async function addToBlacklist(entries: BlacklistEntry[]): Promise<void> {
  for (const entry of entries) {
    blacklistSet.add(entry.domain.toLowerCase());
  }
  await idbAddBlacklist(entries);
}

export async function replaceBlacklistCache(entries: BlacklistEntry[]): Promise<void> {
  blacklistSet = new Set(entries.map((e) => e.domain.toLowerCase()));
  await idbReplaceBlacklist(entries);
}

export async function removeFromBlacklist(domain: string): Promise<void> {
  const d = domain.toLowerCase();
  blacklistSet.delete(d);
  await idbRemoveBlacklist(d);
}

// --- Getters ---

export function getWhitelistDomains(): string[] {
  return [...whitelistSet];
}

export function getBlacklistSize(): number {
  return blacklistSet.size;
}

// --- Migration from chrome.storage.sync ---

async function runMigration(): Promise<void> {
  const migrated = await getMetadata("migrationV1Complete");
  if (migrated === true) return;

  logger.debug("Running IndexedDB migration...");

  // Migrate whitelist from chrome.storage.sync
  try {
    const result = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.sync.get(["settings"], (r) => resolve(r));
    });
    const settings = result.settings as { whitelist?: string[] } | undefined;
    if (settings?.whitelist?.length) {
      for (const domain of settings.whitelist) {
        const d = domain.toLowerCase();
        if (!whitelistSet.has(d)) {
          whitelistSet.add(d);
          await idbAddWhitelist(d, "import");
        }
      }
      logger.debug(`Migrated ${settings.whitelist.length} whitelist entries`);
    }
  } catch (err) {
    logger.warn("Whitelist migration error:", err);
  }

  // Load built-in blocklist into IndexedDB
  try {
    const response = await fetch(chrome.runtime.getURL("lists/tr-phishing.json"));
    const data = await response.json() as { domains: BlacklistEntry[] };
    if (data.domains?.length) {
      const entries: BlacklistEntry[] = data.domains.map((d) => ({
        domain: d.domain.toLowerCase(),
        category: d.category || "other",
        addedAt: d.addedAt || new Date().toISOString().split("T")[0],
        source: d.source || "builtin",
      }));
      await idbAddBlacklist(entries);
      for (const entry of entries) {
        blacklistSet.add(entry.domain);
      }
      logger.debug(`Migrated ${entries.length} blacklist entries`);
    }
  } catch (err) {
    logger.warn("Blacklist migration error:", err);
  }

  await setMetadata("migrationV1Complete", true);
  logger.debug("Migration complete");
}

// --- Initialization ---

export async function initListCache(): Promise<void> {
  if (cacheReady) return;

  try {
    // Load from IndexedDB into memory
    const [whitelist, blacklist] = await Promise.all([getAllWhitelist(), getAllBlacklist()]);

    whitelistSet = new Set(whitelist.map((e) => e.domain));
    blacklistSet = new Set(blacklist.map((e) => e.domain));

    // Run migration if needed (first time after update)
    await runMigration();

    cacheReady = true;
    logger.debug(`List cache ready: ${whitelistSet.size} whitelist, ${blacklistSet.size} blacklist`);
  } catch (err) {
    logger.warn("List cache init failed, using empty sets:", err);
    cacheReady = true; // Still mark ready so the extension doesn't hang
  }
}

// --- Reset (for testing) ---

export function resetListCache(): void {
  whitelistSet = new Set();
  blacklistSet = new Set();
  cacheReady = false;
}
