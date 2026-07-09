import { DB_NAME, DB_VERSION, STORE_NAME } from "./constants";
import { createDomainRecord, isExpired } from "./record";
import type { DomainFeatures, DomainRecord, UsomVerdict } from "./types";

// Open the persistent USOM verdict cache
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "domain" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the USOM cache database"));
  });
}

// Convert stored date values back into Date objects
function toDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Validate a record read from IndexedDB
function deserializeRecord(value: unknown): DomainRecord | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Record<string, unknown>;
  const verdict = candidate.verdict;
  const checkedAt = toDate(candidate.checkedAt);
  const expiresAt = toDate(candidate.expiresAt);

  if (
    typeof candidate.domain !== "string" ||
    (verdict !== true && verdict !== false && verdict !== null) ||
    !checkedAt ||
    !expiresAt
  ) {
    return null;
  }

  return {
    domain: candidate.domain,
    verdict: verdict as UsomVerdict,
    ...(typeof candidate.desc === "string" ? { desc: candidate.desc } : {}),
    ...(typeof candidate.criticality === "number"
      ? { criticality: candidate.criticality }
      : {}),
    checkedAt,
    expiresAt,
  };
}

// Store a new verdict with its calculated expiration time
export async function saveVerdict(features: DomainFeatures): Promise<DomainRecord> {
  const db = await openDB();
  const record = createDomainRecord(features);

  return new Promise<DomainRecord>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);

    transaction.oncomplete = () => {
      db.close();
      resolve(record);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Could not save the USOM verdict"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("Saving the USOM verdict was aborted"));
    };
  });
}

// Read a valid verdict and delete it if it has expired
export async function getVerdict(domain: string): Promise<DomainRecord | null> {
  const db = await openDB();

  return new Promise<DomainRecord | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(domain);
    let record: DomainRecord | null = null;

    request.onsuccess = () => {
      record = deserializeRecord(request.result);
      if (record && isExpired(record)) {
        store.delete(domain);
        record = null;
      }
    };
    request.onerror = () => transaction.abort();

    transaction.oncomplete = () => {
      db.close();
      resolve(record);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("Could not read the USOM verdict"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("Reading the USOM verdict was aborted"));
    };
  });
}
