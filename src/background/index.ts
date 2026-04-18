// Alparslan - Background Service Worker
import "@/utils/browser-polyfill";
import { type Message, type ExtensionSettings, type ExtensionStats, type SiteReport, type ScanHistoryEntry, DEFAULT_SETTINGS, DEFAULT_STATS, MAX_HISTORY_ENTRIES } from "@/utils/types";
import type { PageAnalysisResult } from "@/detector/page-analyzer";
import { checkUrl, checkUrlConfirmed, extractDomain } from "@/detector/url-checker";
import { fetchRemoteBlocklist, scheduleListUpdates } from "@/blocklist/updater";
import { initUsomBlocklist, scheduleUsomUpdates } from "@/blocklist/usom-updater";
import { initWhitelist, scheduleWhitelistUpdates, getDynamicWhitelistSize } from "@/blocklist/whitelist-updater";
import { checkBreach, loadBreachDatabase as loadBreachDB, initBreachCache } from "@/breach/checker";
import { collectCurrentWeekMetrics, collectPreviousWeekMetrics, recordPageProtocol, recordThreatVisit, recordTrackerBlocked } from "@/dashboard/metrics-collector";
import { calculateScore } from "@/dashboard/score-calculator";
import type { BreachEntry } from "@/breach/types";
import { initListCache, isWhitelisted, addToWhitelist, removeFromWhitelist, addToBlacklist, getWhitelistDomains, getBlacklistSize } from "@/storage/list-cache";
import type { BlacklistEntry } from "@/storage/types";
import { startRequestMonitoring, stopRequestMonitoring, updateMonitoringSettings, getMonitoringStats, getTabMonitoringStats, clearTabStats } from "@/network/request-monitor";
import { setTtlMinutes } from "@/network/url-check-cache";
import t from "@/i18n/tr";
import { logger } from "@/utils/logger";

interface ExtensionState {
  enabled: boolean;
  checkedUrls: number;
  settings: ExtensionSettings;
  stats: ExtensionStats;
  reports: SiteReport[];
  history: ScanHistoryEntry[];
  pageAnalysis: Map<string, PageAnalysisResult>;
}

const state: ExtensionState = {
  enabled: true,
  checkedUrls: 0,
  settings: { ...DEFAULT_SETTINGS },
  stats: { ...DEFAULT_STATS },
  reports: [],
  history: [],
  pageAnalysis: new Map(),
};

function persistStats(): void {
  chrome.storage.sync.set({ stats: state.stats });
}

/**
 * Drops query string + fragment before persisting a URL.
 * Scan history and site reports would otherwise leak password-reset
 * tokens, OAuth codes, magic-link credentials, and similar
 * query-string secrets into chrome.storage.local.
 */
function sanitizeUrlForStorage(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    // Not a parseable URL — fall back to the domain or empty string
    // rather than emitting the raw value, which may itself be noise.
    return extractDomain(url) ?? "";
  }
}

function addHistoryEntry(url: string, level: string, score: number): void {
  const safeUrl = sanitizeUrlForStorage(url);
  const domain = extractDomain(url) || safeUrl;
  state.history.unshift({ url: safeUrl, domain, level: level as ScanHistoryEntry["level"], score, checkedAt: Date.now() });
  if (state.history.length > MAX_HISTORY_ENTRIES) {
    state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
  }
  chrome.storage.local.set({ history: state.history });
}

// --- Service worker init (runs on every wake-up, not just install) ---
// Init gate — CHECK_URL waits for this before responding
let initDone = false;
let resolveInit: () => void;
const initReady = new Promise<void>((resolve) => { resolveInit = resolve; });

// Debug timing state
const initTimings: Record<string, number> = { _startedAt: Date.now() };

// Init progress tracking — exposed to popup via GET_INIT_STATUS
interface InitProgress {
  ready: boolean;
  step: string;
  percent: number;
  steps: { name: string; done: boolean; ms?: number }[];
}

const initProgress: InitProgress = {
  ready: false,
  step: t.init.starting,
  percent: 0,
  steps: [
    { name: t.init.settings, done: false },
    { name: t.init.blacklist, done: false },
    { name: t.init.usom, done: false },
    { name: t.init.whitelist, done: false },
    { name: t.init.breachDb, done: false },
  ],
};

function updateProgress(stepIndex: number, ms?: number): void {
  initProgress.steps[stepIndex].done = true;
  if (ms !== undefined) initProgress.steps[stepIndex].ms = ms;
  const done = initProgress.steps.filter((s) => s.done).length;
  initProgress.percent = Math.round((done / initProgress.steps.length) * 100);
  initProgress.step = stepIndex < initProgress.steps.length - 1
    ? initProgress.steps[stepIndex + 1].name + " " + t.init.loadingSuffix
    : t.init.ready;
}

async function initServiceWorker(): Promise<void> {
  const t0 = Date.now();

  // Step 1: Load settings from sync storage
  initProgress.step = t.init.settings + " " + t.init.loadingSuffix;
  const [syncResult, localResult] = await Promise.all([
    new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.sync.get(["enabled", "settings", "stats", "reports"], (r) => resolve(r));
    }),
    new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get(["history"], (r) => resolve(r));
    }),
  ]);
  initTimings.storageLoad = Date.now() - t0;
  updateProgress(0, initTimings.storageLoad);

  if (syncResult.enabled !== undefined) {
    state.enabled = syncResult.enabled as boolean;
  }
  if (syncResult.settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...(syncResult.settings as ExtensionSettings) };
  }
  if (syncResult.stats) {
    state.stats = { ...DEFAULT_STATS, ...(syncResult.stats as ExtensionStats) };
  }
  if (syncResult.reports) {
    // Strip legacy query/fragment from pre-sanitise reports that were
    // written before this version.
    state.reports = (syncResult.reports as SiteReport[]).map((r) => ({
      ...r,
      url: sanitizeUrlForStorage(r.url),
    }));
  }
  // History is stored in local (no sync size limit)
  if (localResult.history) {
    state.history = (localResult.history as ScanHistoryEntry[]).map((e) => ({
      ...e,
      url: sanitizeUrlForStorage(e.url),
    }));
  }

  // Step 2: Init blacklist cache from IndexedDB
  initProgress.step = t.init.blacklist + " " + t.init.loadingSuffix;
  const t1 = Date.now();
  await initListCache();
  initTimings.cacheInit = Date.now() - t1;
  updateProgress(1, initTimings.cacheInit);

  // Steps 3-5: USOM + whitelist + breach (parallel)
  initProgress.step = t.init.usom + " " + t.init.loadingSuffix;
  const t2 = Date.now();

  const [usomResult, wlResult, breachResult] = await Promise.allSettled([
    initUsomBlocklist(),
    initWhitelist(),
    initBreachCache(),
  ]);

  const t2end = Date.now() - t2;
  initTimings.usomWhitelistBreach = t2end;

  updateProgress(2, t2end); // USOM
  if (usomResult.status === "rejected") logger.warn("USOM init failed:", usomResult.reason);

  updateProgress(3, t2end); // Whitelist
  if (wlResult.status === "rejected") logger.warn("Whitelist init failed:", wlResult.reason);

  updateProgress(4, t2end); // Breach
  if (breachResult.status === "rejected") logger.warn("Breach init failed:", breachResult.reason);

  // Set URL check cache TTL from settings
  setTtlMinutes(state.settings.urlCacheTtlMinutes);

  // Start network request monitoring if enabled
  if (state.settings.networkMonitoringEnabled) {
    startRequestMonitoring(state.settings);
  }

  initTimings.total = Date.now() - t0;
  initProgress.ready = true;
  initProgress.step = t.init.ready;
  initProgress.percent = 100;
  initDone = true;
  resolveInit();
  logger.debug(`Service worker initialized in ${initTimings.total}ms (storage: ${initTimings.storageLoad}ms, cache: ${initTimings.cacheInit}ms)`);

  // Re-scan all open tabs now that lists are loaded
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id || !tab.url || tab.url.startsWith("chrome") || tab.url.startsWith("about:")) continue;
      const result = checkUrl(tab.url, state.settings.protectionLevel);
      updateBadge(tab.id, result.level);

      // Push warning directly for dangerous tabs (backup to RESCAN pull)
      if ((result.level === "DANGEROUS" || result.level === "SUSPICIOUS") && state.settings.showDomWarnings !== false) {
        chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_WARNING",
          level: result.level,
          reason: result.reasons.join(", "),
          score: result.score,
        }).catch(() => {});
      }

      // Also tell content script to re-run full analysis
      chrome.tabs.sendMessage(tab.id, { type: "RESCAN" }).catch(() => {});
    }
  });
}

initServiceWorker().catch((err) => {
  logger.warn("Service worker init error:", err);
});

chrome.runtime.onInstalled.addListener(() => {
  logger.debug("Extension installed");

  // Clear any leftover DNR block rules from previous version
  if (chrome.declarativeNetRequest?.getDynamicRules) {
    chrome.declarativeNetRequest.getDynamicRules().then((rules) => {
      const blockRuleIds = rules.filter((r) => r.id >= 1000).map((r) => r.id);
      if (blockRuleIds.length > 0) {
        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: blockRuleIds });
        logger.debug(`Cleared ${blockRuleIds.length} leftover DNR rules`);
      }
    }).catch(() => {});
  }

  // Load built-in blocklist into IndexedDB (migration handles existing data)
  fetch(chrome.runtime.getURL("lists/tr-phishing.json"))
    .then((r) => r.json())
    .then((data: { domains: BlacklistEntry[] }) => {
      const entries: BlacklistEntry[] = data.domains.map((d) => ({
        domain: d.domain,
        category: d.category || "other",
        addedAt: d.addedAt || new Date().toISOString().split("T")[0],
        source: d.source || "builtin",
      }));
      return addToBlacklist(entries);
    })
    .then(() => {
      logger.debug("Built-in blocklist loaded into IndexedDB");
    })
    .catch(() => {
      logger.warn("Could not load blocklist");
    });

  // Schedule periodic list updates (USOM + whitelist + remote blocklist)
  scheduleUsomUpdates();
  scheduleWhitelistUpdates();
  scheduleListUpdates();
  fetchRemoteBlocklist();

  // Load built-in breach database
  fetch(chrome.runtime.getURL("lists/breached-sites.json"))
    .then((r) => r.json())
    .then((data: { breaches: BreachEntry[] }) => {
      return loadBreachDB(data.breaches).then(() => {
        logger.debug("Breach DB stored in IndexedDB: " + String(data.breaches.length) + " entries");
      });
    })
    .catch(() => {
      logger.warn("Could not load breach database");
    });

});

// Message types that mutate extension state. They are only accepted from
// extension-own pages (popup, options). Content scripts should never be
// able to flip protection level, toggle the kill-switch, or mutate the
// whitelist on the user's behalf. A content script has `sender.tab` set;
// an extension page does not.
const PRIVILEGED_MESSAGE_TYPES = new Set([
  "SET_ENABLED",
  "SETTINGS_UPDATED",
  "ADD_TO_WHITELIST",
  "REMOVE_FROM_WHITELIST",
  "CLEAR_HISTORY",
]);

function isFromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.tab === undefined;
}

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    if (PRIVILEGED_MESSAGE_TYPES.has(message.type) && !isFromExtensionPage(sender)) {
      // Don't include sender.url in prod logger.warn — it's a page URL
      // and the logger contract keeps PII out of end-user consoles.
      logger.warn("Rejected privileged message:", message.type);
      logger.debug("Rejected sender url:", sender.url);
      sendResponse({ ok: false, reason: "unauthorized" });
      return true;
    }

    if (message.type === "PING") {
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return true;
    }

    if (message.type === "CHECK_URL") {
      const url = message.url as string;

      // Kill switch: when disabled, return a neutral response and suppress
      // DOM warnings. Skips stats bump so disabled periods don't inflate counters.
      if (!state.enabled) {
        sendResponse({
          level: "UNKNOWN",
          score: 0,
          reasons: [],
          url,
          checkedAt: Date.now(),
          showDomWarnings: false,
        });
        return true;
      }

      state.checkedUrls++;
      state.stats.urlsChecked++;

      (async () => {
        // Wait for lists to be loaded before checking — prevents false SAFE on cold start
        if (!initDone) await initReady;

        // Check whitelist via IndexedDB-backed cache
        try {
          const hostname = new URL(url).hostname.toLowerCase();
          if (isWhitelisted(hostname)) {
            persistStats();
            addHistoryEntry(url, "SAFE", 0);
            sendResponse({ level: "SAFE", score: 0, reasons: [t.reasons.whitelisted], url, checkedAt: Date.now(), showDomWarnings: state.settings.showDomWarnings !== false });
            return;
          }
        } catch { /* invalid URL — let checkUrl handle it */ }

        // Use async confirmed check (verifies USOM Bloom filter hits against IDB)
        const result = await checkUrlConfirmed(url, state.settings.protectionLevel);
        if (result.level === "DANGEROUS" || result.level === "SUSPICIOUS") {
          state.stats.threatsBlocked++;
          recordThreatVisit(result.level);
        }
        persistStats();
        addHistoryEntry(url, result.level, result.score);
        sendResponse({ ...result, showDomWarnings: state.settings.showDomWarnings !== false });
      })();
      return true;
    }

    if (message.type === "GET_STATE") {
      sendResponse({ ...state });
      return true;
    }

    if (message.type === "SET_ENABLED") {
      state.enabled = message.enabled as boolean;
      chrome.storage.sync.set({ enabled: state.enabled });

      if (state.enabled) {
        // Re-enable: restart network monitor if the user has that feature on
        if (state.settings.networkMonitoringEnabled) {
          startRequestMonitoring(state.settings);
        }
      } else {
        // Kill switch: stop network monitoring and clear action badges on all tabs
        stopRequestMonitoring();
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (tab.id !== undefined) chrome.action.setBadgeText({ text: "", tabId: tab.id });
          }
        });
      }

      sendResponse({ enabled: state.enabled });
      return true;
    }

    if (message.type === "GET_SETTINGS") {
      sendResponse({ settings: state.settings });
      return true;
    }

    if (message.type === "SETTINGS_UPDATED") {
      const newSettings = message.settings as ExtensionSettings;
      const oldSettings = state.settings;
      state.settings = newSettings;

      // Update URL cache TTL
      setTtlMinutes(newSettings.urlCacheTtlMinutes);

      // Start/stop network monitoring based on setting change
      if (newSettings.networkMonitoringEnabled && !oldSettings.networkMonitoringEnabled) {
        startRequestMonitoring(newSettings);
      } else if (!newSettings.networkMonitoringEnabled && oldSettings.networkMonitoringEnabled) {
        stopRequestMonitoring();
      } else if (newSettings.networkMonitoringEnabled) {
        // Monitoring already running — propagate settings changes (blocking toggle, etc.)
        updateMonitoringSettings(newSettings);
      }

      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "ADD_TO_WHITELIST") {
      const domain = message.domain as string;
      addToWhitelist(domain).catch((err) => logger.warn("Whitelist add error:", err));
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "REMOVE_FROM_WHITELIST") {
      const domain = message.domain as string;
      removeFromWhitelist(domain).catch((err) => logger.warn("Whitelist remove error:", err));
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_LIST_STATS") {
      const tabId = message.tabId as number | undefined;
      const monitoring = getMonitoringStats();
      const tabData = tabId ? getTabMonitoringStats(tabId) : null;
      sendResponse({
        whitelistSize: getWhitelistDomains().length,
        blacklistSize: getBlacklistSize(),
        dynamicWhitelistSize: getDynamicWhitelistSize(),
        settings: state.settings,
        ...monitoring,
        tab: tabData,
      });
      return true;
    }

    if (message.type === "GET_STATS") {
      sendResponse({ stats: state.stats });
      return true;
    }

    if (message.type === "TRACKER_BLOCKED") {
      state.stats.trackersBlocked++;
      persistStats();
      recordTrackerBlocked();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "REPORT_SITE") {
      const domain = message.domain as string;
      const alreadyReported = state.reports.some((r) => r.domain === domain);
      if (alreadyReported) {
        sendResponse({ ok: false, reason: "already_reported" });
        return true;
      }
      // Rate-limit to prevent a loop in the UI / buggy caller from
      // filling chrome.storage.sync (which has a fixed quota).
      const hourAgo = Date.now() - 60 * 60 * 1000;
      const reportsLastHour = state.reports.filter((r) => r.reportedAt >= hourAgo).length;
      if (reportsLastHour >= 10) {
        sendResponse({ ok: false, reason: "rate_limited" });
        return true;
      }
      const reportType = message.reportType as "dangerous" | "safe";
      const description = (message.description as string) || "";
      const url = message.url as string;
      const report: SiteReport = {
        domain,
        // Sanitize — reports are persisted; keep them free of
        // query/fragment secrets.
        url: sanitizeUrlForStorage(url),
        reportType,
        description,
        reportedAt: Date.now(),
      };
      state.reports.push(report);
      chrome.storage.sync.set({ reports: state.reports });

      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_REPORTS") {
      sendResponse({ reports: state.reports });
      return true;
    }

    if (message.type === "GET_HISTORY") {
      sendResponse({ history: state.history });
      return true;
    }

    if (message.type === "CLEAR_HISTORY") {
      state.history = [];
      chrome.storage.local.set({ history: [] });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "PAGE_ANALYSIS") {
      const domain = message.domain as string;
      const analysis: PageAnalysisResult = {
        hasLoginForm: message.hasLoginForm as boolean,
        hasPasswordField: message.hasPasswordField as boolean,
        hasCreditCardField: message.hasCreditCardField as boolean,
        suspiciousFormAction: message.suspiciousFormAction as boolean,
        externalFormAction: (message.externalFormAction as string) || null,
        score: message.score as number,
        reasons: message.reasons as string[],
      };
      state.pageAnalysis.set(domain, analysis);
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_PAGE_ANALYSIS") {
      const domain = message.domain as string;
      const analysis = state.pageAnalysis.get(domain) || null;
      sendResponse({ analysis });
      return true;
    }

    if (message.type === "CHECK_BREACH") {
      const domain = message.domain as string;
      const result = checkBreach(domain);
      sendResponse(result);
      return true;
    }

    if (message.type === "GET_DASHBOARD_SCORE") {
      (async () => {
        const currentWeek = await collectCurrentWeekMetrics();
        const previousWeek = await collectPreviousWeekMetrics();
        const dashboard = calculateScore(currentWeek);
        dashboard.previousWeek = previousWeek;
        sendResponse({ dashboard });
      })();
      return true;
    }

    if (message.type === "RECORD_PROTOCOL") {
      const url = message.url as string;
      recordPageProtocol(url);
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_INIT_STATUS") {
      sendResponse(initProgress);
      return true;
    }

    if (message.type === "GET_DEBUG_INFO") {
      sendResponse({
        initTimings,
        blacklistSize: getBlacklistSize(),
        whitelistSize: getWhitelistDomains().length,
        monitoring: getMonitoringStats(),
        uptime: Date.now() - (initTimings._startedAt || Date.now()),
      });
      return true;
    }

    return false;
  },
);

const BADGE_CONFIG: Record<string, { text: string; color: string }> = {
  SAFE: { text: "\u2713", color: "#16a34a" },
  DANGEROUS: { text: "!", color: "#dc2626" },
  SUSPICIOUS: { text: "?", color: "#d97706" },
  UNKNOWN: { text: "", color: "#6b7280" },
};

function updateBadge(tabId: number, level: string): void {
  const badge = BADGE_CONFIG[level] || BADGE_CONFIG.UNKNOWN;
  chrome.action.setBadgeText({ text: badge.text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: badge.color, tabId });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!state.enabled) return;

  // On URL change: record protocol (sync, doesn't need lists)
  if (changeInfo.url) {
    recordPageProtocol(changeInfo.url);
  }

  // On page complete: push SHOW_WARNING to content script as a backup
  // (content script also pulls via CHECK_URL, but this ensures coverage)
  if (changeInfo.status === "complete") {
    const url = tab.url;
    if (!url || url.startsWith("chrome") || url.startsWith("about:") || url.startsWith("moz-extension")) return;

    (async () => {
      if (!initDone) await initReady;
      const result = await checkUrlConfirmed(url, state.settings.protectionLevel);
      updateBadge(tabId, result.level);

      if ((result.level === "DANGEROUS" || result.level === "SUSPICIOUS") && state.settings.showDomWarnings !== false) {
        chrome.tabs.sendMessage(tabId, {
          type: "SHOW_WARNING",
          level: result.level,
          reason: result.reasons.join(", "),
          score: result.score,
        }).catch(() => {});
      }
    })();
  }
});

// Clean up tab stats when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabStats(tabId);
});

export { state };
export type { ExtensionState };
