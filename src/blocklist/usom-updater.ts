// USOM blocklist updater — fetches the Turkish national CERT list,
// stores in IndexedDB, and builds a Bloom filter for fast lookups.

import { bulkInsertDomains, getAllDomains, getDomainCount, clearBySource } from "./indexeddb-store";
import {
  createBloomFilterAsync,
  bloomFilterTest,
  serializeBloomFilter,
  deserializeBloomFilter,
  type BloomFilterData,
} from "./bloom-filter";
import { logger } from "@/utils/logger";
import { fetchTextWithLimit, FETCH_LIMITS, sha256Hex } from "@/utils/safe-fetch";

const USOM_ALARM_NAME = "alparslan-usom-update";
const STORAGE_KEY_VERSION = "usom-version";
const STORAGE_KEY_BLOOM = "usom-bloom";
const UPDATE_INTERVAL_MINUTES = 360; // 6 hours

const GITHUB_BASE = "https://raw.githubusercontent.com/AsabiAlgo/blocklists/main";
const USOM_LIST_URL = `${GITHUB_BASE}/usom-blocklist.txt`;
const USOM_VERSION_URL = `${GITHUB_BASE}/version.json`;

interface UsomVersion {
  version: string;
  hash: string;
  /**
   * Optional SHA-256 hex digest of the raw list body. Upstream publishes
   * a short version tag in `hash`; when it adds a full content hash we
   * verify the downloaded body against it.
   */
  sha256?: string;
  count: number;
  updatedAt: string;
}

let bloomFilter: BloomFilterData | null = null;

export function usomBloomTest(domain: string): boolean {
  if (!bloomFilter) return false;
  return bloomFilterTest(bloomFilter, domain);
}

export function isUsomReady(): boolean {
  return bloomFilter !== null;
}

export function getUsomFilterSize(): number {
  if (!bloomFilter) return 0;
  return bloomFilter.numBits;
}

async function rebuildBloomFromIDB(): Promise<void> {
  const domains = await getAllDomains();
  if (domains.length === 0) return;

  bloomFilter = await createBloomFilterAsync(domains);
  logger.debug(`USOM Bloom filter built: ${domains.length} domains, ${(bloomFilter.bits.byteLength / 1024).toFixed(0)}KB`);

  try {
    const serialized = serializeBloomFilter(bloomFilter);
    const base64 = arrayBufferToBase64(serialized);
    await chrome.storage.local.set({ [STORAGE_KEY_BLOOM]: base64 });
  } catch (err) {
    logger.warn("Could not cache Bloom filter:", err);
  }
}

async function loadCachedBloom(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_BLOOM);
    const base64 = result[STORAGE_KEY_BLOOM] as string | undefined;
    if (!base64) return false;

    const buffer = base64ToArrayBuffer(base64);
    bloomFilter = deserializeBloomFilter(buffer);
    logger.debug(`USOM Bloom filter loaded from cache: ${bloomFilter.numBits} bits`);
    return true;
  } catch {
    return false;
  }
}

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function checkRemoteVersion(): Promise<{ hasUpdate: boolean; remote: UsomVersion | null }> {
  try {
    const { text } = await fetchTextWithLimit(USOM_VERSION_URL, {
      maxBytes: FETCH_LIMITS.versionJson,
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });

    const remote: UsomVersion = JSON.parse(text);
    const stored = await chrome.storage.local.get(STORAGE_KEY_VERSION);
    const local = stored[STORAGE_KEY_VERSION] as { hash?: string } | undefined;

    if (!local?.hash || local.hash !== remote.hash) {
      return { hasUpdate: true, remote };
    }
    return { hasUpdate: false, remote };
  } catch {
    return { hasUpdate: false, remote: null };
  }
}

async function fetchRemoteList(): Promise<{ domains: string[]; sha256: string }> {
  const { text } = await fetchTextWithLimit(USOM_LIST_URL, {
    maxBytes: FETCH_LIMITS.usomBlocklistTxt,
  });
  const sha256 = await sha256Hex(text);
  return { domains: parseDomainList(text), sha256 };
}

/**
 * Reject the download if integrity can be confidently falsified.
 * Three layers:
 *  1. Upstream-published full SHA-256 (`version.sha256`) — strict match.
 *  2. Locally-stored SHA-256 from a previous fetch of the same version
 *     tag — if `version.hash` is unchanged but the content hash moved,
 *     that's mid-flight tampering and we reject.
 *  3. Otherwise accept (no authoritative hash to compare against).
 */
async function verifyIntegrity(
  computed: string,
  version: Partial<UsomVersion>,
): Promise<void> {
  if (version.sha256 && version.sha256 !== computed) {
    throw new Error(
      `USOM integrity failure: published sha256=${version.sha256} computed=${computed}`,
    );
  }
  const stored = await chrome.storage.local.get(STORAGE_KEY_VERSION);
  const local = stored[STORAGE_KEY_VERSION] as { hash?: string; sha256?: string } | undefined;
  if (
    local?.hash && local.hash === version.hash &&
    local.sha256 && local.sha256 !== computed
  ) {
    throw new Error(
      `USOM integrity drift: version tag ${version.hash} unchanged but content sha256 moved ${local.sha256} → ${computed}`,
    );
  }
}

async function storeAndBuildBloom(
  domains: string[],
  version: Partial<UsomVersion>,
  sha256: string,
): Promise<void> {
  // Build Bloom filter FIRST — makes USOM checks available immediately
  bloomFilter = await createBloomFilterAsync(domains);
  logger.debug(`USOM Bloom filter built: ${domains.length} domains, ${(bloomFilter.bits.byteLength / 1024).toFixed(0)}KB`);

  // Cache serialized Bloom filter for fast next startup
  try {
    const serialized = serializeBloomFilter(bloomFilter);
    const base64 = arrayBufferToBase64(serialized);
    await chrome.storage.local.set({ [STORAGE_KEY_BLOOM]: base64 });
  } catch (err) {
    logger.warn("Could not cache Bloom filter:", err);
  }

  // Save version info (small, fast). Content sha256 is retained for
  // drift-detection on subsequent fetches.
  await chrome.storage.local.set({
    [STORAGE_KEY_VERSION]: {
      hash: version.hash ?? "",
      sha256,
      date: version.updatedAt ?? new Date().toISOString(),
      count: domains.length,
    },
  });

  // IDB writes — fire-and-forget, don't block init
  // Bloom filter handles lookups; IDB is only for hasDomain() confirmations
  clearBySource("usom")
    .then(() => bulkInsertDomains(domains, "usom"))
    .then((inserted) => logger.debug(`USOM list stored in IndexedDB: ${inserted} domains`))
    .catch((err) => logger.warn("USOM IDB store error:", err));
}

export async function initUsomBlocklist(): Promise<void> {
  // Fast path: load cached Bloom filter
  const cacheLoaded = await loadCachedBloom();
  if (cacheLoaded) return;

  // Check if IDB already has data
  const count = await getDomainCount();
  if (count > 0) {
    await rebuildBloomFromIDB();
    return;
  }

  // First time: fetch from GitHub
  try {
    logger.debug("Fetching USOM list from GitHub...");
    const t0 = Date.now();
    const { domains, sha256 } = await fetchRemoteList();
    const { remote } = await checkRemoteVersion();
    await verifyIntegrity(sha256, remote ?? {});
    await storeAndBuildBloom(domains, remote ?? {}, sha256);
    logger.debug(`USOM init complete: ${domains.length} domains in ${Date.now() - t0}ms`);
  } catch (err) {
    logger.warn("USOM init error:", err);
  }
}

export function scheduleUsomUpdates(): void {
  if (chrome.alarms) {
    chrome.alarms.create(USOM_ALARM_NAME, {
      delayInMinutes: 5,
      periodInMinutes: UPDATE_INTERVAL_MINUTES,
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === USOM_ALARM_NAME) refreshUsomList();
    });
  } else {
    // Safari: no alarms API — use setInterval fallback
    setTimeout(() => refreshUsomList(), 5 * 60_000);
    setInterval(() => refreshUsomList(), UPDATE_INTERVAL_MINUTES * 60_000);
  }
}

async function refreshUsomList(): Promise<void> {
  try {
    const { hasUpdate, remote } = await checkRemoteVersion();
    if (!hasUpdate) {
      logger.debug("USOM list is up to date");
      return;
    }

    logger.debug("USOM list update available, downloading...");
    const { domains, sha256 } = await fetchRemoteList();
    if (domains.length > 0) {
      await verifyIntegrity(sha256, remote ?? {});
      await storeAndBuildBloom(domains, remote ?? {}, sha256);
      logger.debug(`USOM list refreshed: ${domains.length} domains`);
    }
  } catch (err) {
    logger.warn("USOM refresh error:", err);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
