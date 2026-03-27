// Alparslan - Background Service Worker
import "@/utils/browser-polyfill";
import { type Message, type ExtensionSettings, type ExtensionStats, type SiteReport, type ScanHistoryEntry, DEFAULT_SETTINGS, DEFAULT_STATS, MAX_HISTORY_ENTRIES } from "@/utils/types";
import type { PageAnalysisResult } from "@/detector/page-analyzer";
import { checkUrl, loadBlocklist, extractDomain } from "@/detector/url-checker";
import { fetchRemoteBlocklist, submitReport, scheduleListUpdates } from "@/blocklist/updater";

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

function addHistoryEntry(url: string, level: string, score: number): void {
  const domain = extractDomain(url) || url;
  state.history.unshift({ url, domain, level: level as ScanHistoryEntry["level"], score, checkedAt: Date.now() });
  if (state.history.length > MAX_HISTORY_ENTRIES) {
    state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
  }
  chrome.storage.sync.set({ history: state.history });
}

chrome.runtime.onInstalled.addListener(() => {
  console.warn("[Alparslan] Extension installed");
  chrome.storage.sync.get(["enabled", "settings", "stats", "reports", "history"], (result) => {
    if (result.enabled !== undefined) {
      state.enabled = result.enabled as boolean;
    }
    if (result.settings) {
      state.settings = { ...DEFAULT_SETTINGS, ...(result.settings as ExtensionSettings) };
    }
    if (result.stats) {
      state.stats = { ...DEFAULT_STATS, ...(result.stats as ExtensionStats) };
    }
    if (result.reports) {
      state.reports = result.reports as SiteReport[];
    }
    if (result.history) {
      state.history = result.history as ScanHistoryEntry[];
    }
  });

  // Load built-in blocklist, then schedule remote updates
  fetch(chrome.runtime.getURL("lists/tr-phishing.json"))
    .then((r) => r.json())
    .then((data: { domains: { domain: string }[] }) => {
      loadBlocklist(data.domains.map((d) => d.domain));
      console.warn(`[Alparslan] Loaded ${data.domains.length} blocked domains`);
    })
    .catch(() => {
      console.warn("[Alparslan] Could not load blocklist");
    });

  // Schedule periodic remote list updates
  scheduleListUpdates();

  // Try an immediate remote fetch (merges with built-in list)
  fetchRemoteBlocklist();
});

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === "PING") {
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return true;
    }

    if (message.type === "CHECK_URL") {
      state.checkedUrls++;
      state.stats.urlsChecked++;
      const url = message.url as string;

      // Check whitelist — skip detection for whitelisted domains
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (state.settings.whitelist.some((w) => hostname === w || hostname.endsWith("." + w))) {
          persistStats();
          addHistoryEntry(url, "SAFE", 0);
          sendResponse({ level: "SAFE", score: 0, reasons: ["Beyaz listede"], url, checkedAt: Date.now() });
          return true;
        }
      } catch { /* invalid URL — let checkUrl handle it */ }

      const result = checkUrl(message.url as string, state.settings.protectionLevel);
      if (result.level === "DANGEROUS" || result.level === "SUSPICIOUS") {
        state.stats.threatsBlocked++;
      }
      persistStats();
      addHistoryEntry(url, result.level, result.score);
      sendResponse(result);
      return true;
    }

    if (message.type === "GET_STATE") {
      sendResponse({ ...state });
      return true;
    }

    if (message.type === "SET_ENABLED") {
      state.enabled = message.enabled as boolean;
      chrome.storage.sync.set({ enabled: state.enabled });
      sendResponse({ enabled: state.enabled });
      return true;
    }

    if (message.type === "GET_SETTINGS") {
      sendResponse({ settings: state.settings });
      return true;
    }

    if (message.type === "SETTINGS_UPDATED") {
      state.settings = message.settings as ExtensionSettings;
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_STATS") {
      sendResponse({ stats: state.stats });
      return true;
    }

    if (message.type === "TRACKER_BLOCKED") {
      state.stats.trackersBlocked++;
      persistStats();
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
      const reportType = message.reportType as "dangerous" | "safe";
      const description = (message.description as string) || "";
      const url = message.url as string;
      const report: SiteReport = {
        domain,
        url,
        reportType,
        description,
        reportedAt: Date.now(),
      };
      state.reports.push(report);
      chrome.storage.sync.set({ reports: state.reports });

      // Submit to remote API (fire-and-forget)
      submitReport({ domain, url, reportType, description });

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
      chrome.storage.sync.set({ history: [] });
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

    return false;
  },
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  if (changeInfo.url && state.enabled) {
    const result = checkUrl(changeInfo.url, state.settings.protectionLevel);

    if (result.level === "DANGEROUS" || result.level === "SUSPICIOUS") {
      chrome.tabs
        .sendMessage(tabId, {
          type: "SHOW_WARNING",
          level: result.level,
          reason: result.reasons.join(", "),
          score: result.score,
        })
        .catch(() => {});
    }
  }
});

export { state };
export type { ExtensionState };
