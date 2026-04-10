// Network request monitor — observes all requests via webRequest API
import type { ExtensionSettings } from "@/utils/types";
import { isWhitelisted, isBlacklisted } from "@/storage/list-cache";
import { checkUrl, extractDomain, extractRootDomain } from "@/detector/url-checker";
import { getCachedResult, setCachedResult, startPeriodicCleanup, stopPeriodicCleanup } from "./url-check-cache";
import { addDnrBlockRule, syncDnrRulesWithBlacklist, clearAllDnrRules } from "./dnr-manager";
import { getAllBlacklist } from "@/storage/idb";

interface MonitoringStats {
  requestsChecked: number;
  threatsDetected: number;
  requestsBlocked: number;
  recentThreats: Array<{ domain: string; level: string; timestamp: number }>;
}

interface TabStats {
  requestsChecked: number;
  threatsDetected: number;
  requestsBlocked: number;
  domains: Set<string>;
  threats: Array<{ domain: string; level: string; timestamp: number }>;
}

const MAX_RECENT_THREATS = 20;

const stats: MonitoringStats = {
  requestsChecked: 0,
  threatsDetected: 0,
  requestsBlocked: 0,
  recentThreats: [],
};

// Per-tab tracking
const tabStats = new Map<number, TabStats>();

function getOrCreateTabStats(tabId: number): TabStats {
  let ts = tabStats.get(tabId);
  if (!ts) {
    ts = { requestsChecked: 0, threatsDetected: 0, requestsBlocked: 0, domains: new Set(), threats: [] };
    tabStats.set(tabId, ts);
  }
  return ts;
}

let monitoring = false;
let currentSettings: ExtensionSettings | null = null;

// Track main_frame URL per tab to distinguish redirects from new navigations
const tabMainUrl = new Map<number, string>();

const IS_FIREFOX = typeof globalThis.browser !== "undefined"
  && typeof (globalThis.browser as { runtime?: { getBrowserInfo?: unknown } })?.runtime?.getBrowserInfo === "function";

function shouldSkipUrl(url: string): boolean {
  return url.startsWith("chrome") || url.startsWith("moz-extension")
    || url.startsWith("about:") || url.startsWith("data:")
    || url.startsWith("blob:") || url.startsWith("devtools:");
}

function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): chrome.webRequest.BlockingResponse | void {
  if (!monitoring || !currentSettings) return;
  if (shouldSkipUrl(details.url)) return;

  const domain = extractDomain(details.url);
  if (!domain) return;

  stats.requestsChecked++;

  // Per-tab tracking
  const tab = details.tabId > 0 ? getOrCreateTabStats(details.tabId) : null;

  // Reset tab stats only on genuine new navigation (not 301/302 redirects)
  if (details.type === "main_frame" && tab) {
    const prevUrl = tabMainUrl.get(details.tabId);
    const prevDomain = prevUrl ? extractDomain(prevUrl) : null;
    const isRedirect = prevDomain === domain; // same domain = likely redirect

    if (!isRedirect) {
      // New page navigation — reset tab stats
      tab.requestsChecked = 0;
      tab.threatsDetected = 0;
      tab.requestsBlocked = 0;
      tab.domains = new Set();
      tab.threats = [];
    }
    tabMainUrl.set(details.tabId, details.url);
  }

  if (tab) {
    tab.requestsChecked++;
    tab.domains.add(domain);
  }

  // Skip whitelisted domains
  if (isWhitelisted(domain)) return;

  // Check blacklist (O(1) sync lookup)
  const rootDomain = extractRootDomain(domain);
  if (isBlacklisted(domain) || isBlacklisted(rootDomain)) {
    stats.threatsDetected++;
    addRecentThreat(domain, "DANGEROUS");
    if (tab) {
      tab.threatsDetected++;
      // Avoid duplicate threat entries for same domain in this tab
      if (!tab.threats.some((t) => t.domain === domain)) {
        tab.threats.push({ domain, level: "DANGEROUS", timestamp: Date.now() });
      }
    }

    if (currentSettings.networkBlockingEnabled) {
      stats.requestsBlocked++;
      if (tab) tab.requestsBlocked++;

      if (IS_FIREFOX) {
        return { cancel: true };
      }
      addDnrBlockRule(domain).catch(() => {});
    }

    if (details.type === "main_frame" || details.type === "sub_frame") {
      // DOM warning is handled by tabs.onUpdated in background (with retry)
    }

    return;
  }

  // For main_frame requests only: run heuristic checks (expensive)
  if (details.type === "main_frame") {
    const cached = getCachedResult(domain);
    if (cached) {
      if (cached.level === "DANGEROUS" || cached.level === "SUSPICIOUS") {
        stats.threatsDetected++;
        addRecentThreat(domain, cached.level);
        if (tab) {
          tab.threatsDetected++;
          if (!tab.threats.some((t) => t.domain === domain)) {
            tab.threats.push({ domain, level: cached.level, timestamp: Date.now() });
          }
        }
        // DOM warning handled by tabs.onUpdated
      }
      return;
    }

    const t0 = performance.now();
    const result = checkUrl(details.url, currentSettings.protectionLevel);
    const elapsed = performance.now() - t0;
    setCachedResult(domain, result);

    if (elapsed > 5) {
      console.warn(`[Alparslan] URL check took ${elapsed.toFixed(1)}ms for ${domain}`);
    }

    if (result.level === "DANGEROUS" || result.level === "SUSPICIOUS") {
      stats.threatsDetected++;
      addRecentThreat(domain, result.level);
      if (tab) {
        tab.threatsDetected++;
        if (!tab.threats.some((t) => t.domain === domain)) {
          tab.threats.push({ domain, level: result.level, timestamp: Date.now() });
        }
      }
      // DOM warning handled by tabs.onUpdated
    }
  }
}

function addRecentThreat(domain: string, level: string): void {
  stats.recentThreats.unshift({ domain, level, timestamp: Date.now() });
  if (stats.recentThreats.length > MAX_RECENT_THREATS) {
    stats.recentThreats.length = MAX_RECENT_THREATS;
  }
}

export function updateMonitoringSettings(settings: ExtensionSettings): void {
  const wasBlocking = currentSettings?.networkBlockingEnabled ?? false;
  currentSettings = settings;

  // If blocking was just turned ON, sync all blacklist domains as DNR rules
  if (settings.networkBlockingEnabled && !wasBlocking && !IS_FIREFOX) {
    getAllBlacklist()
      .then((entries) => syncDnrRulesWithBlacklist(entries.map((e) => e.domain)))
      .catch((err) => console.warn("[Alparslan] DNR sync on enable failed:", err));
    console.warn("[Alparslan] Blocking enabled — syncing DNR rules");
  }

  // If blocking was just turned OFF, clear all DNR rules
  if (!settings.networkBlockingEnabled && wasBlocking) {
    clearAllDnrRules();
    console.warn("[Alparslan] Blocking disabled — clearing DNR rules");
  }
}

export function startRequestMonitoring(settings: ExtensionSettings): void {
  if (monitoring) return;

  currentSettings = settings;
  monitoring = true;

  // Register webRequest listener (guard against missing API in test environments)
  if (!chrome.webRequest?.onBeforeRequest) {
    console.warn("[Alparslan] webRequest API not available");
    return;
  }

  const extraInfoSpec: string[] = IS_FIREFOX && settings.networkBlockingEnabled ? ["blocking"] : [];

  chrome.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    { urls: ["<all_urls>"] },
    extraInfoSpec.length > 0 ? extraInfoSpec : undefined,
  );

  // Start periodic cache cleanup
  startPeriodicCleanup();

  // Sync or clear DNR rules based on blocking setting
  if (!IS_FIREFOX) {
    if (settings.networkBlockingEnabled) {
      getAllBlacklist()
        .then((entries) => syncDnrRulesWithBlacklist(entries.map((e) => e.domain)))
        .catch((err) => console.warn("[Alparslan] DNR sync failed:", err));
    } else {
      // Clear any leftover DNR rules from previous sessions
      clearAllDnrRules();
    }
  }

  console.warn("[Alparslan] Network request monitoring started");
}

export function stopRequestMonitoring(): void {
  if (!monitoring) return;

  monitoring = false;
  currentSettings = null;

  chrome.webRequest?.onBeforeRequest?.removeListener(onBeforeRequest);
  stopPeriodicCleanup();

  // Clear DNR rules when monitoring is stopped
  clearAllDnrRules();

  console.warn("[Alparslan] Network request monitoring stopped");
}

export function getMonitoringStats(): MonitoringStats {
  return { ...stats, recentThreats: [...stats.recentThreats] };
}

export function getTabMonitoringStats(tabId: number): {
  requestsChecked: number;
  threatsDetected: number;
  requestsBlocked: number;
  domains: string[];
  threats: Array<{ domain: string; level: string; timestamp: number }>;
} | null {
  const ts = tabStats.get(tabId);
  if (!ts) return null;
  return {
    requestsChecked: ts.requestsChecked,
    threatsDetected: ts.threatsDetected,
    requestsBlocked: ts.requestsBlocked,
    domains: [...ts.domains],
    threats: [...ts.threats],
  };
}

export function clearTabStats(tabId: number): void {
  tabStats.delete(tabId);
  tabMainUrl.delete(tabId);
}

export function isMonitoring(): boolean {
  return monitoring;
}
