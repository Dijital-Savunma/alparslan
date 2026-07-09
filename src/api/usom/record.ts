import { USOM_TTL_MS } from "./constants";
import type { DomainFeatures, DomainRecord, UsomVerdict } from "./types";

// Select how long a verdict should stay valid
export function getVerdictTtl(verdict: UsomVerdict): number {
  if (verdict === true) return USOM_TTL_MS.listed;
  if (verdict === false) return USOM_TTL_MS.clean;
  return USOM_TTL_MS.error;
}

// Add cache timestamps to a domain verdict
export function createDomainRecord(
  features: DomainFeatures,
  checkedAt = new Date(),
): DomainRecord {
  return {
    ...features,
    checkedAt,
    expiresAt: new Date(checkedAt.getTime() + getVerdictTtl(features.verdict)),
  };
}

// Check whether a cached record can still be used
export function isExpired(record: Pick<DomainRecord, "expiresAt">, now = Date.now()): boolean {
  return record.expiresAt.getTime() <= now;
}
