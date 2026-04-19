// @vitest-environment happy-dom

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture listener callbacks
let onMessageCallback: (
  message: Record<string, unknown>,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

let onUpdatedCallback: (
  tabId: number,
  changeInfo: { url?: string; status?: string },
  tab: { url?: string },
) => void;

let onInstalledCallback: () => void;

// Setup chrome mock before importing
const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const storageSetMock = vi.fn((_items: unknown, cb?: () => void) => cb?.());
const storageGetMock = vi.fn(
  (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({}),
);

const fetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ domains: [] }),
});

const FAKE_ID = "fake-id";

// Sender shape that matches how the Options page / popup actually look
// when they message the SW — extension-origin URL is what the
// sender-verification guard checks. Use this for any privileged message
// in tests.
const trustedSender = {
  id: FAKE_ID,
  url: `chrome-extension://${FAKE_ID}/options.html`,
  tab: { id: 1 },
};

Object.defineProperty(globalThis, "chrome", {
  value: {
    runtime: {
      id: FAKE_ID,
      onInstalled: {
        addListener: (cb: () => void) => {
          onInstalledCallback = cb;
        },
      },
      onMessage: {
        addListener: (cb: typeof onMessageCallback) => {
          onMessageCallback = cb;
        },
      },
      getURL: (path: string) => `chrome-extension://${FAKE_ID}/${path}`,
    },
    tabs: {
      onUpdated: {
        addListener: (cb: typeof onUpdatedCallback) => {
          onUpdatedCallback = cb;
        },
      },
      onRemoved: { addListener: vi.fn() },
      sendMessage: sendMessageMock,
      query: vi.fn((_q: unknown, cb: (tabs: { id?: number }[]) => void) => cb([])),
    },
    storage: {
      sync: {
        get: storageGetMock,
        set: storageSetMock,
      },
      local: {
        get: vi.fn((_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({})),
        set: vi.fn((_items: unknown, cb?: () => void) => cb?.()),
      },
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
    webRequest: {
      onBeforeRequest: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    declarativeNetRequest: {
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
      getDynamicRules: vi.fn().mockResolvedValue([]),
    },
  },
  writable: true,
});

Object.defineProperty(globalThis, "fetch", {
  value: fetchMock,
  writable: true,
});

describe("Background Service Worker", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMessageMock.mockClear();
    storageSetMock.mockClear();
    fetchMock.mockClear();
    await import("@/background/index");
  });

  describe("PING message", () => {
    it("should respond with PONG", () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback({ type: "PING" }, {}, sendResponse);

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ type: "PONG", timestamp: expect.any(Number) }),
      );
    });
  });

  describe("CHECK_URL message", () => {
    it("should respond with ThreatResult", async () => {
      const sendResponse = vi.fn();
      const result = onMessageCallback(
        { type: "CHECK_URL", url: "https://example.com" },
        {},
        sendResponse,
      );

      expect(result).toBe(true);
      // checkUrlConfirmed is async — wait for it
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          level: expect.any(String),
          score: expect.any(Number),
          url: "https://example.com",
        }),
      );
    });
  });

  describe("GET_STATE message", () => {
    it("should return current state", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_STATE" }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          checkedUrls: expect.any(Number),
        }),
      );
    });
  });

  describe("SET_ENABLED message", () => {
    it("should toggle enabled state", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "SET_ENABLED", enabled: false }, trustedSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ enabled: false });
      expect(storageSetMock).toHaveBeenCalledWith({ enabled: false });
    });

    it("CHECK_URL returns neutral UNKNOWN with showDomWarnings=false when disabled", () => {
      const sr = vi.fn();
      onMessageCallback({ type: "SET_ENABLED", enabled: false }, trustedSender, vi.fn());
      onMessageCallback({ type: "CHECK_URL", url: "https://isbenk.com.tr/login" }, {}, sr);

      // Kill switch path is synchronous — no need to await
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "UNKNOWN",
          score: 0,
          showDomWarnings: false,
        }),
      );
    });
  });

  describe("tabs.onUpdated", () => {
    it("should record protocol on URL change", () => {
      // URL change triggers sync recordPageProtocol
      onUpdatedCallback(1, { url: "https://isbenk.com.tr/login" }, { url: "https://isbenk.com.tr/login" });

      // Badge update and SHOW_WARNING happen async (on status=complete after init gate)
      // In test env, init doesn't complete so async path is not tested here
    });

    it("should not crash for safe URLs", () => {
      onUpdatedCallback(1, { url: "https://example.com" }, { url: "https://example.com" });
      // No error thrown
    });

    it("should not forward when URL is not changed", () => {
      sendMessageMock.mockClear();
      onUpdatedCallback(1, {}, {});

      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });

  describe("GET_SETTINGS message", () => {
    it("should return current settings", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_SETTINGS" }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            protectionLevel: "medium",
            notificationsEnabled: true,
            whitelist: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe("SETTINGS_UPDATED message", () => {
    it("should update settings", () => {
      const sendResponse = vi.fn();
      const newSettings = {
        protectionLevel: "high",
        notificationsEnabled: false,
        whitelist: ["example.com"],
      };
      onMessageCallback(
        { type: "SETTINGS_UPDATED", settings: newSettings },
        trustedSender,
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ ok: true });

      // Verify settings were updated
      const getResponse = vi.fn();
      onMessageCallback({ type: "GET_SETTINGS" }, {}, getResponse);
      expect(getResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ protectionLevel: "high" }),
        }),
      );
    });
  });

  describe("CHECK_URL with whitelist", () => {
    it("should mark whitelisted domains as SAFE", async () => {
      // Wait for initServiceWorker() to complete (it runs on import)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Use the ADD_TO_WHITELIST message to add via the background worker's own cache instance
      const sr1 = vi.fn();
      onMessageCallback(
        { type: "ADD_TO_WHITELIST", domain: "example.com" },
        trustedSender,
        sr1,
      );
      // Give async write-through a tick to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Then check URL
      const sendResponse = vi.fn();
      onMessageCallback(
        { type: "CHECK_URL", url: "https://example.com/phishing" },
        {},
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ level: "SAFE", reasons: ["Beyaz listede"] }),
      );
    });
  });

  describe("GET_STATS message", () => {
    it("should return current stats", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_STATS" }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            urlsChecked: expect.any(Number),
            threatsBlocked: expect.any(Number),
            trackersBlocked: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe("TRACKER_BLOCKED message", () => {
    it("should increment trackersBlocked", () => {
      // Get initial stats
      const sr1 = vi.fn();
      onMessageCallback({ type: "GET_STATS" }, {}, sr1);
      const initial = sr1.mock.calls[0][0].stats.trackersBlocked;

      // Track a blocked tracker
      const sr2 = vi.fn();
      onMessageCallback({ type: "TRACKER_BLOCKED" }, {}, sr2);
      expect(sr2).toHaveBeenCalledWith({ ok: true });

      // Verify increment
      const sr3 = vi.fn();
      onMessageCallback({ type: "GET_STATS" }, {}, sr3);
      expect(sr3.mock.calls[0][0].stats.trackersBlocked).toBe(initial + 1);
    });
  });

  describe("REPORT_SITE message", () => {
    it("should save a new report", () => {
      const sendResponse = vi.fn();
      onMessageCallback(
        { type: "REPORT_SITE", domain: "evil.com", url: "https://evil.com", reportType: "dangerous", description: "Phishing" },
        {},
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    it("should reject duplicate report for same domain", () => {
      // First report
      const sr1 = vi.fn();
      onMessageCallback(
        { type: "REPORT_SITE", domain: "dup.com", url: "https://dup.com", reportType: "dangerous", description: "" },
        {},
        sr1,
      );
      expect(sr1).toHaveBeenCalledWith({ ok: true });

      // Duplicate
      const sr2 = vi.fn();
      onMessageCallback(
        { type: "REPORT_SITE", domain: "dup.com", url: "https://dup.com/other", reportType: "safe", description: "" },
        {},
        sr2,
      );
      expect(sr2).toHaveBeenCalledWith({ ok: false, reason: "already_reported" });
    });
  });

  describe("GET_REPORTS message", () => {
    it("should return reports array", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_REPORTS" }, {}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ reports: expect.any(Array) }),
      );
    });
  });

  describe("GET_HISTORY message", () => {
    it("should return history array", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_HISTORY" }, {}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ history: expect.any(Array) }),
      );
    });
  });

  describe("CHECK_URL adds history entry", () => {
    it("should add a history entry on URL check", async () => {
      // Check a URL (async due to checkUrlConfirmed)
      const sr1 = vi.fn();
      onMessageCallback({ type: "CHECK_URL", url: "https://test-history.com" }, {}, sr1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get history
      const sr2 = vi.fn();
      onMessageCallback({ type: "GET_HISTORY" }, {}, sr2);
      const history = sr2.mock.calls[0][0].history;
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].domain).toBe("test-history.com");
    });
  });

  describe("CLEAR_HISTORY message", () => {
    it("should clear all history", () => {
      // Add an entry first
      const sr1 = vi.fn();
      onMessageCallback({ type: "CHECK_URL", url: "https://clearme.com" }, {}, sr1);

      // Clear
      const sr2 = vi.fn();
      onMessageCallback({ type: "CLEAR_HISTORY" }, trustedSender, sr2);
      expect(sr2).toHaveBeenCalledWith({ ok: true });

      // Verify empty
      const sr3 = vi.fn();
      onMessageCallback({ type: "GET_HISTORY" }, {}, sr3);
      expect(sr3.mock.calls[0][0].history).toEqual([]);
    });
  });

  describe("PAGE_ANALYSIS message", () => {
    it("should store page analysis for a domain", () => {
      const sendResponse = vi.fn();
      onMessageCallback(
        {
          type: "PAGE_ANALYSIS",
          domain: "suspicious.com",
          hasLoginForm: true,
          hasPasswordField: true,
          hasCreditCardField: false,
          suspiciousFormAction: true,
          externalFormAction: "evil.com",
          score: 40,
          reasons: ["Form verisi farkli sunucuya gonderiliyor"],
        },
        {},
        sendResponse,
      );
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("GET_PAGE_ANALYSIS message", () => {
    it("should return stored analysis for a domain", () => {
      // First store analysis
      const sr1 = vi.fn();
      onMessageCallback(
        {
          type: "PAGE_ANALYSIS",
          domain: "fetch-test.com",
          hasLoginForm: false,
          hasPasswordField: false,
          hasCreditCardField: true,
          suspiciousFormAction: false,
          externalFormAction: null,
          score: 15,
          reasons: ["Kredi karti bilgisi isteniyor"],
        },
        {},
        sr1,
      );

      // Fetch it
      const sr2 = vi.fn();
      onMessageCallback({ type: "GET_PAGE_ANALYSIS", domain: "fetch-test.com" }, {}, sr2);
      const analysis = sr2.mock.calls[0][0].analysis;
      expect(analysis).not.toBeNull();
      expect(analysis.hasCreditCardField).toBe(true);
      expect(analysis.reasons).toContain("Kredi karti bilgisi isteniyor");
    });

    it("should return null for unknown domain", () => {
      const sendResponse = vi.fn();
      onMessageCallback({ type: "GET_PAGE_ANALYSIS", domain: "unknown-domain.com" }, {}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ analysis: null });
    });
  });

  describe("onInstalled", () => {
    it("should load blocklist into IndexedDB", () => {
      onInstalledCallback();
      // onInstalled fetches the blocklist JSON
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe("initServiceWorker", () => {
    it("should load saved state from storage", () => {
      // initServiceWorker is called automatically on import
      // Settings/stats from sync, history from local
      expect(storageGetMock).toHaveBeenCalledWith(
        ["enabled", "settings", "stats", "reports"],
        expect.any(Function),
      );
    });
  });

  // Regression coverage for the sender-verification bug where options_page
  // opened as a tab (Chrome's default) was treated as an untrusted sender
  // because `sender.tab` is set. Only tab-less senders OR senders whose
  // `.url` starts with chrome-extension://<own-id>/ should be trusted.
  describe("privileged message sender verification (#2)", () => {
    const privilegedTypes = [
      { type: "SET_ENABLED", enabled: false },
      { type: "SETTINGS_UPDATED", settings: { protectionLevel: "low", whitelist: [] } },
      { type: "ADD_TO_WHITELIST", domain: "attacker-injected.com" },
      { type: "REMOVE_FROM_WHITELIST", domain: "anything.com" },
      { type: "CLEAR_HISTORY" },
    ];

    it.each(privilegedTypes)(
      "accepts %s from a popup (no tab)",
      (msg) => {
        const sr = vi.fn();
        const popupSender = { id: FAKE_ID, url: `chrome-extension://${FAKE_ID}/popup.html` };
        onMessageCallback(msg, popupSender, sr);
        // Not rejected with unauthorized reason
        expect(sr).not.toHaveBeenCalledWith(
          expect.objectContaining({ ok: false, reason: "unauthorized" }),
        );
      },
    );

    it.each(privilegedTypes)(
      "accepts %s from options_page opened as a tab",
      (msg) => {
        const sr = vi.fn();
        const optionsInTab = {
          id: FAKE_ID,
          url: `chrome-extension://${FAKE_ID}/options.html`,
          tab: { id: 1 },
        };
        onMessageCallback(msg, optionsInTab, sr);
        expect(sr).not.toHaveBeenCalledWith(
          expect.objectContaining({ ok: false, reason: "unauthorized" }),
        );
      },
    );

    it.each(privilegedTypes)(
      "rejects %s from a content script in a web page",
      (msg) => {
        const sr = vi.fn();
        const contentScript = {
          id: FAKE_ID, // same extension, but injected into a page
          url: "https://evil-page.example/login",
          tab: { id: 2 },
        };
        onMessageCallback(msg, contentScript, sr);
        expect(sr).toHaveBeenCalledWith({ ok: false, reason: "unauthorized" });
      },
    );

    it.each(privilegedTypes)(
      "rejects %s from a different extension",
      (msg) => {
        const sr = vi.fn();
        const otherExtension = {
          id: "other-extension-id",
          url: `chrome-extension://other-extension-id/popup.html`,
        };
        onMessageCallback(msg, otherExtension, sr);
        expect(sr).toHaveBeenCalledWith({ ok: false, reason: "unauthorized" });
      },
    );
  });
});
