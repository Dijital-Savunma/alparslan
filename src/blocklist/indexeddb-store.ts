// IndexedDB store for large domain blocklists (USOM, etc.)
// Persists across service worker restarts without re-downloading.

const DB_NAME = "alparslan-blocklist";
const DB_VERSION = 1;
const STORE_NAME = "domains";
const BATCH_SIZE = 5000;

interface DomainRecord {
  domain: string;
  source: "usom" | "builtin" | "remote";
  addedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "domain" });
        store.createIndex("source", "source", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Insert domains in batches for performance.
 * Uses put (upsert) so duplicates are safely overwritten.
 */
export async function bulkInsertDomains(
  domains: string[],
  source: DomainRecord["source"],
): Promise<number> {
  const db = await openDB();
  const now = Date.now();
  let inserted = 0;

  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      for (const domain of batch) {
        const record: DomainRecord = {
          domain: domain.toLowerCase(),
          source,
          addedAt: now,
        };
        store.put(record);
      }

      tx.oncomplete = () => {
        inserted += batch.length;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  db.close();
  return inserted;
}

/**
 * Check if a single domain exists in the store.
 */
export async function hasDomain(domain: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(domain.toLowerCase());

    request.onsuccess = () => {
      db.close();
      resolve(request.result !== undefined);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get all domains from the store (for Bloom filter rebuild).
 */
export async function getAllDomains(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      db.close();
      resolve(request.result as string[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get total number of domains in the store.
 */
export async function getDomainCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all domains from a specific source.
 */
export async function clearBySource(source: DomainRecord["source"]): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("source");
    const request = index.openCursor(IDBKeyRange.only(source));
    let deleted = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve(deleted);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
