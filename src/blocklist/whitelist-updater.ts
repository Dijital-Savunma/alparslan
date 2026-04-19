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
import { fetchTextWithLimit, FETCH_LIMITS } from "@/utils/safe-fetch";

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

// Domains that must NEVER appear in the dynamic whitelist. A single
// entry like "com.tr" or "co.uk" would, combined with list-cache's
// parent-match behaviour, make every subdomain of that public suffix
// a whitelisted bypass. We reject them at parse time rather than rely
// on upstream discipline — the remote list is a supply-chain surface.
const PUBLIC_SUFFIXES: ReadonlySet<string> = new Set([
  // Single-label gTLDs / ccTLDs
  "com", "org", "net", "edu", "gov", "mil", "int", "info", "biz",
  "tr", "uk", "de", "fr", "jp", "kr", "cn", "ru", "it", "es", "pl",
  "nl", "be", "at", "ch", "se", "no", "fi", "dk", "br", "au", "ca",
  "us", "io", "co", "me", "tv", "xyz", "app", "dev",
  // Compound Turkish public suffixes (most relevant for this project)
  "com.tr", "net.tr", "org.tr", "edu.tr", "gov.tr", "mil.tr", "bel.tr",
  "pol.tr", "k12.tr", "tsk.tr", "av.tr", "dr.tr",
  // Other common compound public suffixes
  "co.uk", "ac.uk", "gov.uk", "org.uk", "me.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.jp", "ne.jp", "or.jp", "ac.jp",
  "co.kr", "or.kr",
  "co.in", "net.in",
  "co.za",
  "com.br", "net.br", "org.br", "gov.br",
]);

function isPublicSuffix(domain: string): boolean {
  return PUBLIC_SUFFIXES.has(domain);
}

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => {
      if (!line || line.startsWith("#")) return false;
      // At least one dot — single-label "com" is always a public suffix.
      if (!line.includes(".")) return false;
      if (isPublicSuffix(line)) {
        logger.warn("Rejected public-suffix whitelist entry:", line);
        return false;
      }
      return true;
    });
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

async function fetchList(url: string, maxBytes: number): Promise<string[]> {
  const { text } = await fetchTextWithLimit(url, { maxBytes, cache: "no-cache" });
  return parseDomainList(text);
}

async function hasRemoteUpdate(): Promise<boolean> {
  try {
    const { text } = await fetchTextWithLimit(VERSION_URL, {
      maxBytes: FETCH_LIMITS.versionJson,
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    const data = JSON.parse(text);
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
    fetchList(WHITELIST_URL, FETCH_LIMITS.whitelistTxt),
    fetchList(UGC_DOMAINS_URL, FETCH_LIMITS.ugcDomainsTxt).catch(() => [] as string[]),
    fetchList(RISKY_TLDS_URL, FETCH_LIMITS.riskyTldsTxt).catch(() => [] as string[]),
  ]);

  // Shrink sanity — if the new list is <50% of what we already trust,
  // treat as corruption/attack and keep the previous list. The whitelist
  // grows over time; a sudden 50% collapse is far more likely to be a
  // bad deploy or a compromised upstream than a legitimate purge.
  const previousSize = whitelistDomains.size;
  if (previousSize >= 100 && wlDomains.length < previousSize * 0.5) {
    logger.warn(
      `Whitelist refresh rejected: new size ${wlDomains.length} < 50% of previous ${previousSize}`,
    );
    return;
  }

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
    const { text } = await fetchTextWithLimit(VERSION_URL, {
      maxBytes: FETCH_LIMITS.versionJson,
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    const data = JSON.parse(text);
    await setMetadata("whitelist-version", {
      hash: data.whitelist?.hash ?? "",
      updatedAt: new Date().toISOString(),
    });
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
