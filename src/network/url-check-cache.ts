import type { ThreatResult } from "@/utils/types";

interface CacheEntry {
  result: ThreatResult;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
let ttlMs = 5 * 60 * 1000; // default 5 minutes
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function setTtlMinutes(minutes: number): void {
  ttlMs = minutes * 60 * 1000;
}

export function getTtlMinutes(): number {
  return ttlMs / 60 / 1000;
}

export function getCachedResult(domain: string): ThreatResult | null {
  const entry = cache.get(domain.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.cachedAt >= ttlMs) {
    cache.delete(domain.toLowerCase());
    return null;
  }
  return entry.result;
}

export function setCachedResult(domain: string, result: ThreatResult): void {
  cache.set(domain.toLowerCase(), { result, cachedAt: Date.now() });
}

export function clearExpired(): void {
  const now = Date.now();
  for (const [domain, entry] of cache) {
    if (now - entry.cachedAt >= ttlMs) {
      cache.delete(domain);
    }
  }
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheSize(): number {
  return cache.size;
}

export function startPeriodicCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(clearExpired, 60_000); // every 1 minute
}

export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
