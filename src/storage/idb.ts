import type { WhitelistEntry, BlacklistEntry } from "./types";

const DB_NAME = "AlparslanDB";
const DB_VERSION = 2;

let db: IDBDatabase | null = null;

function isDbOpen(): boolean {
  if (!db) return false;
  try {
    // Check liveness — closed connections throw on property access
    db.objectStoreNames;
    return true;
  } catch {
    db = null;
    return false;
  }
}

export function getDb(): Promise<IDBDatabase> {
  if (isDbOpen()) return Promise.resolve(db!);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      // v1 stores
      if (!database.objectStoreNames.contains("whitelist")) {
        database.createObjectStore("whitelist", { keyPath: "domain" });
      }

      if (!database.objectStoreNames.contains("blacklist")) {
        const blacklistStore = database.createObjectStore("blacklist", { keyPath: "domain" });
        blacklistStore.createIndex("category", "category", { unique: false });
        blacklistStore.createIndex("source", "source", { unique: false });
      }

      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }

      // v2 stores
      if (!database.objectStoreNames.contains("dynamic-whitelist")) {
        database.createObjectStore("dynamic-whitelist", { keyPath: "domain" });
      }

      if (!database.objectStoreNames.contains("ugc-domains")) {
        database.createObjectStore("ugc-domains", { keyPath: "domain" });
      }

      if (!database.objectStoreNames.contains("risky-tlds")) {
        database.createObjectStore("risky-tlds", { keyPath: "tld" });
      }

      if (!database.objectStoreNames.contains("breaches")) {
        const breachStore = database.createObjectStore("breaches", { keyPath: "domain" });
        breachStore.createIndex("name", "name", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      db.onclose = () => { db = null; };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// --- Whitelist operations ---

export async function getAllWhitelist(): Promise<WhitelistEntry[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("whitelist", "readonly");
    const store = tx.objectStore("whitelist");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as WhitelistEntry[]);
    request.onerror = () => reject(request.error);
  });
}

export async function addWhitelistEntry(domain: string, addedBy: "user" | "import" = "user"): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("whitelist", "readwrite");
    const store = tx.objectStore("whitelist");
    const entry: WhitelistEntry = { domain: domain.toLowerCase(), addedAt: Date.now(), addedBy };
    store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeWhitelistEntry(domain: string): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("whitelist", "readwrite");
    const store = tx.objectStore("whitelist");
    store.delete(domain.toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Blacklist operations ---

export async function getAllBlacklist(): Promise<BlacklistEntry[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("blacklist", "readonly");
    const store = tx.objectStore("blacklist");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as BlacklistEntry[]);
    request.onerror = () => reject(request.error);
  });
}

export async function addBlacklistEntries(entries: BlacklistEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("blacklist", "readwrite");
    const store = tx.objectStore("blacklist");
    for (const entry of entries) {
      store.put({ ...entry, domain: entry.domain.toLowerCase() });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceBlacklist(entries: BlacklistEntry[]): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("blacklist", "readwrite");
    const store = tx.objectStore("blacklist");
    store.clear();
    for (const entry of entries) {
      store.put({ ...entry, domain: entry.domain.toLowerCase() });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeBlacklistEntry(domain: string): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("blacklist", "readwrite");
    const store = tx.objectStore("blacklist");
    store.delete(domain.toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Metadata operations ---

export async function getMetadata(key: string): Promise<unknown> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("metadata", "readonly");
    const store = tx.objectStore("metadata");
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result as { key: string; value: unknown } | undefined;
      resolve(result?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function setMetadata(key: string, value: unknown): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("metadata", "readwrite");
    const store = tx.objectStore("metadata");
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Dynamic whitelist operations ---

export async function getAllDynamicWhitelist(): Promise<string[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("dynamic-whitelist", "readonly");
    const request = tx.objectStore("dynamic-whitelist").getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
}

export async function replaceDynamicWhitelist(domains: string[]): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("dynamic-whitelist", "readwrite");
    const store = tx.objectStore("dynamic-whitelist");
    store.clear();
    for (const domain of domains) {
      store.put({ domain: domain.toLowerCase() });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- UGC domains operations ---

export async function getAllUgcDomains(): Promise<string[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("ugc-domains", "readonly");
    const request = tx.objectStore("ugc-domains").getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
}

export async function replaceUgcDomains(domains: string[]): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("ugc-domains", "readwrite");
    const store = tx.objectStore("ugc-domains");
    store.clear();
    for (const domain of domains) {
      store.put({ domain: domain.toLowerCase() });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Risky TLDs operations ---

export async function getAllRiskyTlds(): Promise<string[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("risky-tlds", "readonly");
    const request = tx.objectStore("risky-tlds").getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
}

export async function replaceRiskyTlds(tlds: string[]): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("risky-tlds", "readwrite");
    const store = tx.objectStore("risky-tlds");
    store.clear();
    for (const tld of tlds) {
      store.put({ tld: tld.toLowerCase() });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Breach operations ---

export interface BreachRecord {
  domain: string;
  name: string;
  date: string;
  dataTypes: string[];
}

export async function getAllBreaches(): Promise<BreachRecord[]> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("breaches", "readonly");
    const request = tx.objectStore("breaches").getAll();
    request.onsuccess = () => resolve(request.result as BreachRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function replaceBreaches(breaches: BreachRecord[]): Promise<void> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("breaches", "readwrite");
    const store = tx.objectStore("breaches");
    store.clear();
    for (const b of breaches) {
      store.put(b);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBreachByDomain(domain: string): Promise<BreachRecord | null> {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("breaches", "readonly");
    const request = tx.objectStore("breaches").get(domain.toLowerCase());
    request.onsuccess = () => resolve((request.result as BreachRecord) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
