import type { BreachEntry, BreachCheckResult } from "./types";

let breachDatabase: BreachEntry[] = [];

export function loadBreachDatabase(entries: BreachEntry[], replace = true): void {
  if (replace) {
    breachDatabase = entries.map((e) => ({ ...e, domain: e.domain.toLowerCase() }));
  } else {
    for (const entry of entries) {
      breachDatabase.push({ ...entry, domain: entry.domain.toLowerCase() });
    }
  }
}

export function getBreachDatabaseSize(): number {
  return breachDatabase.length;
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

  const matches = breachDatabase.filter(
    (entry) => entry.domain === rootDomain || entry.domain === normalizedHost,
  );

  return {
    isBreached: matches.length > 0,
    breaches: matches,
  };
}
