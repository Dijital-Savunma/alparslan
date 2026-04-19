// Browser API compatibility layer for Chrome/Firefox
// Firefox uses `browser.*` (Promise-based), Chrome uses `chrome.*` (callback-based)
// This module ensures chrome.* is always available

declare global {
  // eslint-disable-next-line no-var
  var browser: typeof chrome | undefined;
}

// Firefox provides both chrome (callback-based) and browser (Promise-based).
// Always prefer browser for consistent Promise-based APIs (.catch() etc.)
if (typeof globalThis.browser !== "undefined") {
  (globalThis as unknown as { chrome: typeof chrome }).chrome = globalThis.browser;
}

// Firefox MV2 uses browserAction, MV3 uses action — normalize to chrome.action
if (typeof chrome !== "undefined" && !chrome.action && chrome.browserAction) {
  (chrome as unknown as { action: typeof chrome.browserAction }).action = chrome.browserAction;
}

export {};
