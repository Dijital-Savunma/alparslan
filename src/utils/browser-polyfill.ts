// Browser API compatibility layer for Chrome/Firefox
// Firefox uses `browser.*` (Promise-based), Chrome uses `chrome.*` (callback-based)
// This module ensures chrome.* is always available

declare global {
  // eslint-disable-next-line no-var
  var browser: typeof chrome | undefined;
}

if (typeof globalThis.chrome === "undefined" && typeof globalThis.browser !== "undefined") {
  // Firefox: alias browser to chrome
  (globalThis as unknown as { chrome: typeof chrome }).chrome = globalThis.browser;
}

export {};
