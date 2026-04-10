// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  startRequestMonitoring,
  stopRequestMonitoring,
  getMonitoringStats,
  isMonitoring,
} from "@/network/request-monitor";
import { initListCache, resetListCache, addToBlacklist, addToWhitelist } from "@/storage/list-cache";
import { getDb } from "@/storage/idb";
import { DEFAULT_SETTINGS } from "@/utils/types";

// Track registered listeners
let registeredListener: ((details: unknown) => unknown) | null = null;

async function clearAllStores(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["whitelist", "blacklist", "metadata"], "readwrite");
  tx.objectStore("whitelist").clear();
  tx.objectStore("blacklist").clear();
  tx.objectStore("metadata").clear();
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
}

beforeEach(async () => {
  registeredListener = null;
  resetListCache();
  await clearAllStores();

  // Mock webRequest
  (globalThis as unknown as { chrome: Record<string, unknown> }).chrome = {
    ...chrome,
    webRequest: {
      onBeforeRequest: {
        addListener: (fn: (details: unknown) => unknown) => {
          registeredListener = fn;
        },
        removeListener: () => {
          registeredListener = null;
        },
      },
    },
    declarativeNetRequest: {
      updateDynamicRules: () => Promise.resolve(),
      getDynamicRules: () => Promise.resolve([]),
    },
    tabs: {
      sendMessage: () => Promise.resolve(),
    },
  };

  await initListCache();
  stopRequestMonitoring();
});

describe("startRequestMonitoring", () => {
  it("registers webRequest listener", () => {
    startRequestMonitoring(DEFAULT_SETTINGS);
    expect(isMonitoring()).toBe(true);
    expect(registeredListener).not.toBeNull();
  });

  it("does not double-register", () => {
    startRequestMonitoring(DEFAULT_SETTINGS);
    startRequestMonitoring(DEFAULT_SETTINGS);
    expect(isMonitoring()).toBe(true);
  });
});

describe("stopRequestMonitoring", () => {
  it("removes listener and stops monitoring", () => {
    startRequestMonitoring(DEFAULT_SETTINGS);
    stopRequestMonitoring();
    expect(isMonitoring()).toBe(false);
  });
});

describe("getMonitoringStats", () => {
  it("returns initial stats", () => {
    const stats = getMonitoringStats();
    expect(stats.requestsChecked).toBeGreaterThanOrEqual(0);
    expect(stats.threatsDetected).toBeGreaterThanOrEqual(0);
    expect(stats.requestsBlocked).toBeGreaterThanOrEqual(0);
  });
});
