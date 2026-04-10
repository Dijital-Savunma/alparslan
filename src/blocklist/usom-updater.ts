// USOM blocklist updater — fetches the Turkish national CERT list,
// stores in IndexedDB, and builds a Bloom filter for fast lookups.

import { bulkInsertDomains, getAllDomains, getDomainCount, clearBySource } from "./indexeddb-store";
import {
  createBloomFilter,
  bloomFilterTest,
  serializeBloomFilter,
  deserializeBloomFilter,
  type BloomFilterData,
} from "./bloom-filter";

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

  bloomFilter = createBloomFilter(domains);
  console.warn(`[Alparslan] USOM Bloom filter built: ${domains.length} domains, ${(bloomFilter.bits.byteLength / 1024).toFixed(0)}KB`);

  try {
    const serialized = serializeBloomFilter(bloomFilter);
    const base64 = arrayBufferToBase64(serialized);
    await chrome.storage.local.set({ [STORAGE_KEY_BLOOM]: base64 });
  } catch (err) {
    console.warn("[Alparslan] Could not cache Bloom filter:", err);
  }
}

async function loadCachedBloom(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_BLOOM);
    const base64 = result[STORAGE_KEY_BLOOM] as string | undefined;
    if (!base64) return false;

    const buffer = base64ToArrayBuffer(base64);
    bloomFilter = deserializeBloomFilter(buffer);
    console.warn(`[Alparslan] USOM Bloom filter loaded from cache: ${bloomFilter.numBits} bits`);
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
    const response = await fetch(USOM_VERSION_URL, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (!response.ok) return { hasUpdate: false, remote: null };

    const remote: UsomVersion = await response.json();
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

async function fetchRemoteList(): Promise<string[]> {
  const response = await fetch(USOM_LIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch USOM list from GitHub: ${response.status}`);
  }
  const text = await response.text();
  return parseDomainList(text);
}

async function storeAndBuildBloom(domains: string[], version: Partial<UsomVersion>): Promise<void> {
  await clearBySource("usom");
  const inserted = await bulkInsertDomains(domains, "usom");
  console.warn(`[Alparslan] USOM list stored in IndexedDB: ${inserted} domains`);
  await rebuildBloomFromIDB();
  await chrome.storage.local.set({
    [STORAGE_KEY_VERSION]: {
      hash: version.hash ?? "",
      date: version.updatedAt ?? new Date().toISOString(),
      count: inserted,
    },
  });
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
    console.warn("[Alparslan] Fetching USOM list from GitHub...");
    const t0 = Date.now();
    const domains = await fetchRemoteList();
    const { remote } = await checkRemoteVersion();
    await storeAndBuildBloom(domains, remote ?? {});
    console.warn(`[Alparslan] USOM init complete: ${domains.length} domains in ${Date.now() - t0}ms`);
  } catch (err) {
    console.warn("[Alparslan] USOM init error:", err);
  }
}

export function scheduleUsomUpdates(): void {
  chrome.alarms.create(USOM_ALARM_NAME, {
    delayInMinutes: 5,
    periodInMinutes: UPDATE_INTERVAL_MINUTES,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === USOM_ALARM_NAME) {
      refreshUsomList();
    }
  });
}

async function refreshUsomList(): Promise<void> {
  try {
    const { hasUpdate, remote } = await checkRemoteVersion();
    if (!hasUpdate) {
      console.warn("[Alparslan] USOM list is up to date");
      return;
    }

    console.warn("[Alparslan] USOM list update available, downloading...");
    const domains = await fetchRemoteList();
    if (domains.length > 0) {
      await storeAndBuildBloom(domains, remote ?? {});
      console.warn(`[Alparslan] USOM list refreshed: ${domains.length} domains`);
    }
  } catch (err) {
    console.warn("[Alparslan] USOM refresh error:", err);
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
