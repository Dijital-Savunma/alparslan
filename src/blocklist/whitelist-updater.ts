// Whitelist updater — fetches trusted domain list from GitHub,
// stores in memory as a Set (13K domains, ~200KB — no Bloom filter needed).

const GITHUB_BASE = "https://raw.githubusercontent.com/AsabiAlgo/blocklists/main";
const WHITELIST_URL = `${GITHUB_BASE}/whitelist.txt`;
const UGC_DOMAINS_URL = `${GITHUB_BASE}/ugc-domains.txt`;
const RISKY_TLDS_URL = `${GITHUB_BASE}/risky-tlds.txt`;
const VERSION_URL = `${GITHUB_BASE}/version.json`;

const STORAGE_KEY_WHITELIST = "whitelist-domains";
const STORAGE_KEY_UGC = "ugc-domains";
const STORAGE_KEY_RISKY_TLDS = "risky-tlds";
const STORAGE_KEY_WL_VERSION = "whitelist-version";
const ALARM_NAME = "alparslan-whitelist-update";
const UPDATE_INTERVAL_MINUTES = 360; // 6 hours

let whitelistDomains: Set<string> = new Set();
let ugcDomains: Set<string> = new Set();
let riskyTlds: string[] = [];

/**
 * Check if a domain is in the whitelist.
 */
export function isWhitelisted(domain: string): boolean {
  return whitelistDomains.has(domain.toLowerCase());
}

/**
 * Check if a domain is a UGC subdomain (should not be auto-trusted).
 */
export function isUgcDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  for (const ugc of ugcDomains) {
    if (lower === ugc || lower.endsWith("." + ugc)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a domain uses a risky TLD. Returns the matching TLD or null.
 */
export function getRiskyTld(domain: string): string | null {
  const lower = domain.toLowerCase();
  for (const tld of riskyTlds) {
    if (lower.endsWith(tld)) {
      return tld;
    }
  }
  return null;
}

export function getWhitelistSize(): number {
  return whitelistDomains.size;
}

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Load cached lists from chrome.storage.local.
 */
async function loadFromCache(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY_WHITELIST,
      STORAGE_KEY_UGC,
      STORAGE_KEY_RISKY_TLDS,
    ]);

    const wlData = result[STORAGE_KEY_WHITELIST] as string[] | undefined;
    const ugcData = result[STORAGE_KEY_UGC] as string[] | undefined;
    const tldData = result[STORAGE_KEY_RISKY_TLDS] as string[] | undefined;

    if (!wlData || wlData.length === 0) return false;

    whitelistDomains = new Set(wlData);
    ugcDomains = new Set(ugcData ?? []);
    riskyTlds = tldData ?? [];

    console.warn(`[Alparslan] Whitelist loaded from cache: ${whitelistDomains.size} domains`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a text list from a URL.
 */
async function fetchList(url: string): Promise<string[]> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  return parseDomainList(text);
}

/**
 * Check remote version hash for whitelist.
 */
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

    const stored = await chrome.storage.local.get(STORAGE_KEY_WL_VERSION);
    const localHash = (stored[STORAGE_KEY_WL_VERSION] as { hash?: string })?.hash;

    return localHash !== remoteHash;
  } catch {
    return false;
  }
}

/**
 * Fetch all lists from GitHub and cache locally.
 */
async function fetchAndCache(): Promise<void> {
  console.warn("[Alparslan] Fetching whitelist from GitHub...");

  const [wlDomains, ugcList, tldList] = await Promise.all([
    fetchList(WHITELIST_URL),
    fetchList(UGC_DOMAINS_URL),
    fetchList(RISKY_TLDS_URL),
  ]);

  whitelistDomains = new Set(wlDomains);
  ugcDomains = new Set(ugcList);
  riskyTlds = tldList;

  // Cache in chrome.storage.local
  await chrome.storage.local.set({
    [STORAGE_KEY_WHITELIST]: wlDomains,
    [STORAGE_KEY_UGC]: ugcList,
    [STORAGE_KEY_RISKY_TLDS]: tldList,
  });

  // Store version info
  try {
    const response = await fetch(VERSION_URL, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (response.ok) {
      const data = await response.json();
      await chrome.storage.local.set({
        [STORAGE_KEY_WL_VERSION]: {
          hash: data.whitelist?.hash ?? "",
          updatedAt: new Date().toISOString(),
        },
      });
    }
  } catch {
    // version check is optional
  }

  console.warn(
    `[Alparslan] Whitelist loaded: ${whitelistDomains.size} domains, ` +
    `${ugcDomains.size} UGC domains, ${riskyTlds.length} risky TLDs`,
  );
}

/**
 * Initialize the whitelist system:
 * 1. Try cache (fast path)
 * 2. If no cache, fetch from GitHub
 */
export async function initWhitelist(): Promise<void> {
  const cacheLoaded = await loadFromCache();
  if (cacheLoaded) return;

  try {
    await fetchAndCache();
  } catch (err) {
    console.warn("[Alparslan] Whitelist init error:", err);
  }
}

/**
 * Refresh whitelist — only downloads if version hash changed.
 */
async function refreshWhitelist(): Promise<void> {
  try {
    const needsUpdate = await hasRemoteUpdate();
    if (!needsUpdate) {
      console.warn("[Alparslan] Whitelist is up to date");
      return;
    }
    await fetchAndCache();
  } catch (err) {
    console.warn("[Alparslan] Whitelist refresh error:", err);
  }
}

/**
 * Schedule periodic whitelist updates.
 */
export function scheduleWhitelistUpdates(): void {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 5,
    periodInMinutes: UPDATE_INTERVAL_MINUTES,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      refreshWhitelist();
    }
  });
}
