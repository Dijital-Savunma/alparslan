import { CACHE_CLEANUP_INTERVAL_MS } from "./constants";
import { isExpired } from "./record";
import type { DomainRecord } from "./types";

// Fast in-memory cache for repeated domain checks
const cache = new Map<string, DomainRecord>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// Add or replace a domain record in memory
export function setCache(record: DomainRecord): void {
  cache.set(record.domain, record);
}

// Return only records that are still valid
export function getCache(domain: string): DomainRecord | null {
  const record = cache.get(domain);
  if (!record) return null;

  if (isExpired(record)) {
    cache.delete(domain);
    return null;
  }

  return record;
}

// Remove all expired records in one cleanup pass
export function clearExpiredCaches(): void {
  const now = Date.now();
  for (const [domain, record] of cache) {
    if (isExpired(record, now)) cache.delete(domain);
  }
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheSize(): number {
  return cache.size;
}

// Start one shared cleanup timer
export function startPeriodicCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(clearExpiredCaches, CACHE_CLEANUP_INTERVAL_MS);
}

// Stop the cleanup timer when it is no longer needed
export function stopPeriodicCleanup(): void {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
}
