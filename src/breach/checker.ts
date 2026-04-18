import type { BreachEntry, BreachCheckResult } from "./types";
import { getAllBreaches, replaceBreaches, getBreachByDomain, type BreachRecord } from "@/storage/idb";
import { logger } from "@/utils/logger";

// In-memory cache for fast sync lookups
let breachCache: Map<string, BreachEntry> = new Map();

function toBreachRecord(e: BreachEntry): BreachRecord {
  return { domain: e.domain.toLowerCase(), name: e.name, date: e.date, dataTypes: e.dataTypes };
}

function toBreachEntry(r: BreachRecord): BreachEntry {
  return { domain: r.domain, name: r.name, date: r.date, dataTypes: r.dataTypes, accountsAffected: 0 };
}

export async function loadBreachDatabase(entries: BreachEntry[]): Promise<void> {
  const records = entries.map(toBreachRecord);
  await replaceBreaches(records);
  breachCache = new Map(entries.map((e) => [e.domain.toLowerCase(), { ...e, domain: e.domain.toLowerCase() }]));
  logger.debug(`Breach DB stored in IndexedDB: ${breachCache.size} entries`);
}

export async function initBreachCache(): Promise<void> {
  try {
    const records = await getAllBreaches();
    if (records.length > 0) {
      breachCache = new Map(records.map((r) => [r.domain, toBreachEntry(r)]));
      logger.debug(`Breach DB loaded from IndexedDB: ${breachCache.size} entries`);
    }
  } catch (err) {
    logger.warn("Breach cache init error:", err);
  }
}

export function getBreachDatabaseSize(): number {
  return breachCache.size;
}

function extractRootForBreach(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  const sld = parts[parts.length - 2];
  if (["com", "gov", "org", "edu", "net"].includes(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export function checkBreach(hostname: string): BreachCheckResult {
  const normalizedHost = hostname.toLowerCase();
  const rootDomain = extractRootForBreach(normalizedHost);

  const matches: BreachEntry[] = [];
  const hostMatch = breachCache.get(normalizedHost);
  const rootMatch = breachCache.get(rootDomain);
  if (hostMatch) matches.push(hostMatch);
  if (rootMatch && rootMatch !== hostMatch) matches.push(rootMatch);

  return {
    isBreached: matches.length > 0,
    breaches: matches,
  };
}
