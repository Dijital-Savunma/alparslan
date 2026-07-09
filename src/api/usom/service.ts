import { getCache, setCache } from "./cache";
import { queryUsom } from "./client";
import { getVerdict, saveVerdict } from "./idb";
import { createDomainRecord } from "./record";
import type { DomainFeatures, DomainRecord } from "./types";

// Share the same request when a domain is checked concurrently
const inFlightChecks = new Map<string, Promise<DomainRecord>>();

// Keep cache keys consistent
function normalizeDomain(input: string): string {
  const domain = input.trim().toLowerCase().replace(/\.+$/u, "");

  if (!domain) {
    throw new TypeError("Domain cannot be empty");
  }

  return domain;
}

// Ignore storage failures and continue with the API
async function readPersistentCache(domain: string): Promise<DomainRecord | null> {
  try {
    return await getVerdict(domain);
  } catch {
    return null;
  }
}

// Query USOM and save the result in both cache layers
async function fetchAndCache(domain: string): Promise<DomainRecord> {
  let features: DomainFeatures;

  try {
    features = await queryUsom(domain);
  } catch {
    features = { domain, verdict: null };
  }

  let record: DomainRecord;
  try {
    record = await saveVerdict(features);
  } catch {
    record = createDomainRecord(features);
  }

  setCache(record);
  return record;
}

// Check persistent cache before making a network request
async function resolveDomain(domain: string): Promise<DomainRecord> {
  const persisted = await readPersistentCache(domain);
  if (persisted) {
    setCache(persisted);
    return persisted;
  }

  return fetchAndCache(domain);
}

// Main entry point for checking one canonical domain
export function checkDomain(input: string): Promise<DomainRecord> {
  const domain = normalizeDomain(input);
  const cached = getCache(domain);
  if (cached) return Promise.resolve(cached);

  const existingRequest = inFlightChecks.get(domain);
  if (existingRequest) return existingRequest;

  const request = resolveDomain(domain).finally(() => {
    inFlightChecks.delete(domain);
  });
  inFlightChecks.set(domain, request);
  return request;
}
