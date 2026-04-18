// Whitelist updater — fetches trusted domain list from GitHub,
// stores in IndexedDB (AlparslanDB), loads into memory as Sets.

import {
  getAllDynamicWhitelist,
  replaceDynamicWhitelist,
  getAllUgcDomains,
  replaceUgcDomains,
  getAllRiskyTlds,
  replaceRiskyTlds,
  getMetadata,
  setMetadata,
} from "@/storage/idb";
import { logger } from "@/utils/logger";

const GITHUB_BASE = "https://raw.githubusercontent.com/AsabiAlgo/blocklists/main";
const WHITELIST_URL = `${GITHUB_BASE}/whitelist.txt`;
const UGC_DOMAINS_URL = `${GITHUB_BASE}/ugc-domains.txt`;
const RISKY_TLDS_URL = `${GITHUB_BASE}/risky-tlds.txt`;
const VERSION_URL = `${GITHUB_BASE}/version.json`;

const ALARM_NAME = "alparslan-whitelist-update";
const UPDATE_INTERVAL_MINUTES = 360; // 6 hours

let whitelistDomains: Set<string> = new Set();
let ugcDomains: Set<string> = new Set();
let riskyTlds: string[] = [];

export function isDynamicWhitelisted(domain: string): boolean {
  return whitelistDomains.has(domain.toLowerCase());
}

export function isUgcDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  for (const ugc of ugcDomains) {
    if (lower === ugc || lower.endsWith("." + ugc)) {
      return true;
    }
  }
  return false;
}

export function getRiskyTld(domain: string): string | null {
  const lower = domain.toLowerCase();
  for (const tld of riskyTlds) {
    if (lower.endsWith(tld)) {
      return tld;
    }
  }
  return null;
}

export function getDynamicWhitelistSize(): number {
  return whitelistDomains.size;
}

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function loadFromIdb(): Promise<boolean> {
  try {
    const [wlDomains, ugcList, tldList] = await Promise.all([
      getAllDynamicWhitelist(),
      getAllUgcDomains(),
      getAllRiskyTlds(),
    ]);

    if (wlDomains.length === 0) return false;

    whitelistDomains = new Set(wlDomains);
    ugcDomains = new Set(ugcList);
    riskyTlds = tldList;

    logger.debug(`Whitelist loaded from IndexedDB: ${whitelistDomains.size} domains`);
    return true;
  } catch {
    return false;
  }
}

async function fetchList(url: string): Promise<string[]> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  return parseDomainList(text);
}

async function hasRemoteUpdate(): Promise<boolean> {
  try {
    const response = await fetch(VERSION_URL, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (!response.ok) return false;

    const data = await response.json();
    const remoteHash = data.whitelist?.hash as string | undefined;
    if (!remoteHash) return false;

    const localVersion = await getMetadata("whitelist-version") as { hash?: string } | null;
    return localVersion?.hash !== remoteHash;
  } catch {
    return false;
  }
}

async function fetchAndStore(): Promise<void> {
  logger.debug("Fetching whitelist from GitHub...");
  const t0 = Date.now();

  const [wlDomains, ugcList, tldList] = await Promise.all([
    fetchList(WHITELIST_URL),
    fetchList(UGC_DOMAINS_URL).catch(() => [] as string[]),
    fetchList(RISKY_TLDS_URL).catch(() => [] as string[]),
  ]);

  // Store in IndexedDB
  await Promise.all([
    replaceDynamicWhitelist(wlDomains),
    replaceUgcDomains(ugcList),
    replaceRiskyTlds(tldList),
  ]);

  // Update in-memory sets
  whitelistDomains = new Set(wlDomains);
  ugcDomains = new Set(ugcList);
  riskyTlds = tldList;

  // Store version info
  try {
    const response = await fetch(VERSION_URL, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (response.ok) {
      const data = await response.json();
      await setMetadata("whitelist-version", {
        hash: data.whitelist?.hash ?? "",
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // version check is optional
  }

  logger.debug(
    `Whitelist stored in IndexedDB: ${whitelistDomains.size} domains, ` +
    `${ugcDomains.size} UGC domains, ${riskyTlds.length} risky TLDs (${Date.now() - t0}ms)`,
  );
}

export async function initWhitelist(): Promise<void> {
  const loaded = await loadFromIdb();
  if (loaded) return;

  try {
    await fetchAndStore();
  } catch (err) {
    logger.warn("Whitelist init error:", err);
  }
}

async function refreshWhitelist(): Promise<void> {
  try {
    const needsUpdate = await hasRemoteUpdate();
    if (!needsUpdate) {
      logger.debug("Whitelist is up to date");
      return;
    }
    await fetchAndStore();
  } catch (err) {
    logger.warn("Whitelist refresh error:", err);
  }
}

export function scheduleWhitelistUpdates(): void {
  if (chrome.alarms) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 5,
      periodInMinutes: UPDATE_INTERVAL_MINUTES,
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) refreshWhitelist();
    });
  } else {
    setTimeout(() => refreshWhitelist(), 5 * 60_000);
    setInterval(() => refreshWhitelist(), UPDATE_INTERVAL_MINUTES * 60_000);
  }
}
