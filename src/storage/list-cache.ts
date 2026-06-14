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
import { canonicalizeUrl, isPublicSuffixHostname } from "@/detector/url-canonicalizer";

let whitelistSet = new Set<string>();
let blacklistSet = new Set<string>();
let cacheReady = false;

function normalizeListDomain(domain: string): string | null {
  const value = String(domain || "").trim().toLowerCase();
  if (!value) return null;

  const canonical = canonicalizeUrl(value.includes("://") ? value : `https://${value}`);
  return canonical.hostname;
}

function canMatchListDomain(domain: string): boolean {
  return domain.includes(".") && !isPublicSuffixHostname(domain);
}

export function isCacheReady(): boolean {
  return cacheReady;
}

// --- Sync lookups (O(1), used on hot path) ---

export function isWhitelisted(domain: string): boolean {
  const d = normalizeListDomain(domain);
  if (!d) return false;
  if (whitelistSet.has(d)) return true;
  // Parent-domain match, capped at 3 labels. A whitelist entry must be
  // a full host name with at least one dot — never a bare TLD or a
  // compound public suffix. Stopping at `length - 2` leaves the last
  // two parts intact (the effective TLD + SLD); stopping at `length - 3`
  // would over-match. Candidates are whitelist entries with 3+ labels.
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (candidate.split(".").length < 2) break;
    if (!canMatchListDomain(candidate)) continue;
    if (whitelistSet.has(candidate)) return true;
  }
  return false;
}

export function isBlacklisted(domain: string): boolean {
  const d = normalizeListDomain(domain);
  if (!d) return false;
  if (blacklistSet.has(d)) return true;
  // Check root domain
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (!canMatchListDomain(candidate)) continue;
    if (blacklistSet.has(candidate)) return true;
  }
  return false;
}

// --- Write-through mutations ---

export async function addToWhitelist(domain: string): Promise<void> {
  const d = normalizeListDomain(domain);
  if (!d || !canMatchListDomain(d)) return;
  whitelistSet.add(d);
  await idbAddWhitelist(d, "user");
}

export async function removeFromWhitelist(domain: string): Promise<void> {
  const d = normalizeListDomain(domain);
  if (!d) return;
  whitelistSet.delete(d);
  await idbRemoveWhitelist(d);
}

export async function addToBlacklist(entries: BlacklistEntry[]): Promise<void> {
  const normalizedEntries: BlacklistEntry[] = [];
  for (const entry of entries) {
    const domain = normalizeListDomain(entry.domain);
    if (!domain || !canMatchListDomain(domain)) continue;
    blacklistSet.add(domain);
    normalizedEntries.push({ ...entry, domain });
  }
  await idbAddBlacklist(normalizedEntries);
}

export async function replaceBlacklistCache(entries: BlacklistEntry[]): Promise<void> {
  const normalizedEntries = entries.flatMap((entry) => {
    const domain = normalizeListDomain(entry.domain);
    return domain && canMatchListDomain(domain) ? [{ ...entry, domain }] : [];
  });
  blacklistSet = new Set(normalizedEntries.map((e) => e.domain));
  await idbReplaceBlacklist(normalizedEntries);
}

export async function removeFromBlacklist(domain: string): Promise<void> {
  const d = normalizeListDomain(domain);
  if (!d) return;
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
        const d = normalizeListDomain(domain);
        if (d && canMatchListDomain(d) && !whitelistSet.has(d)) {
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
        domain: normalizeListDomain(d.domain) ?? "",
        category: d.category || "other",
        addedAt: d.addedAt || new Date().toISOString().split("T")[0],
        source: d.source || "builtin",
      })).filter((entry) => entry.domain && canMatchListDomain(entry.domain));
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

    whitelistSet = new Set(
      whitelist
        .map((e) => normalizeListDomain(e.domain))
        .filter((domain): domain is string => domain !== null && canMatchListDomain(domain)),
    );
    blacklistSet = new Set(
      blacklist
        .map((e) => normalizeListDomain(e.domain))
        .filter((domain): domain is string => domain !== null && canMatchListDomain(domain)),
    );

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
