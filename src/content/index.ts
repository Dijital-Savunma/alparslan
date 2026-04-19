// Alparslan - Content Script
// Not: browser-polyfill import edilmez — content script'te chrome zaten mevcut
import { analyzePage } from "@/detector/page-analyzer";
import t from "@/i18n/tr";

const BANNER_HOST_ID = "alparslan-warning-host";
const BREACH_BANNER_HOST_ID = "alparslan-breach-host";

interface WarningMessage {
  type: "SHOW_WARNING" | "RESCAN";
  level: "DANGEROUS" | "SUSPICIOUS";
  reason: string;
  score: number;
}

// Track if user manually dismissed the banner — don't re-show after dismiss
let bannerDismissed = false;
let bannerObserver: MutationObserver | null = null;

function createWarningBanner(level: string, reason: string): void {
  // Don't recreate if user already dismissed it on this page
  if (bannerDismissed) return;

  // Don't recreate if already showing (prevents race condition flicker)
  const existing = document.getElementById(BANNER_HOST_ID);
  if (existing) return;

  const host = document.createElement("div");
  host.id = BANNER_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "closed" });

  const isDangerous = level === "DANGEROUS";
  const bgColor = isDangerous ? "#dc2626" : "#d97706";
  const icon = isDangerous ? "\u26A0\uFE0F" : "\u26A0";
  const title = isDangerous ? t.banner.dangerous : t.banner.suspicious;

  shadow.innerHTML = `
    <style>
      .banner {
        font-family: system-ui, -apple-system, sans-serif;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
      }
      .banner-content { display: contents; align-items: center; gap: 12px; flex: 1; }
      .banner-icon { font-size: 20px; }
      .banner-title { font-weight: 700; }
      .banner-reason { font-size: 12px; opacity: 0.9; margin-top: 2px; }
      .banner-close {
        background: rgba(255,255,255,0.2);
        border: none; color: white;
        padding: 6px 12px; border-radius: 4px;
        cursor: pointer; font-size: 13px; font-family: inherit;
      }
      .banner-close:hover { background: rgba(255,255,255,0.3); }
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    </style>
    <div class="banner" role="alert">
      <div class="banner-content">
        <span class="banner-icon">${icon}</span>
        <div>
          <div class="banner-title">${t.banner.prefix} ${title}</div>
          <div class="banner-reason">${escapeHtml(reason)}</div>
        </div>
      </div>
      <button class="banner-close" id="close-btn">${t.close}</button>
    </div>
  `;

  shadow.getElementById("close-btn")?.addEventListener("click", () => {
    bannerDismissed = true;
    host.remove();
    if (bannerObserver) { bannerObserver.disconnect(); bannerObserver = null; }
  });

  // Attach to documentElement (more resilient than body — SPA frameworks often replace body children)
  document.documentElement.appendChild(host);

  // Watch for removal by page scripts — re-attach if removed (unless user dismissed)
  if (bannerObserver) bannerObserver.disconnect();
  bannerObserver = new MutationObserver(() => {
    if (!bannerDismissed && !document.getElementById(BANNER_HOST_ID)) {
      document.documentElement.appendChild(host);
    }
  });
  bannerObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function createBreachInfoBanner(reason: string): void {
  const existing = document.getElementById(BREACH_BANNER_HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = BREACH_BANNER_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; bottom: 0; left: 0; width: 100%; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = [
    ".breach-banner { font-family: system-ui, -apple-system, sans-serif; background: #1e40af; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; box-shadow: 0 -2px 8px rgba(0,0,0,0.2); animation: slideUp 0.3s ease-out; }",
    ".breach-content { display: flex; align-items: center; gap: 10px; flex: 1; }",
    ".breach-icon { font-size: 18px; }",
    ".breach-close { background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; }",
    ".breach-close:hover { background: rgba(255,255,255,0.3); }",
    "@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }",
  ].join(" ");
  shadow.appendChild(style);

  const banner = document.createElement("div");
  banner.className = "breach-banner";
  banner.setAttribute("role", "status");

  const content = document.createElement("div");
  content.className = "breach-content";

  const icon = document.createElement("span");
  icon.className = "breach-icon";
  icon.textContent = "\uD83D\uDD13";
  content.appendChild(icon);

  const text = document.createElement("div");
  text.textContent = reason;
  content.appendChild(text);

  banner.appendChild(content);

  const closeBtn = document.createElement("button");
  closeBtn.className = "breach-close";
  closeBtn.textContent = t.close;
  closeBtn.addEventListener("click", () => host.remove());
  banner.appendChild(closeBtn);

  shadow.appendChild(banner);

  if (document.body) {
    document.body.appendChild(host);
  }
}

// Run page analysis after DOM is ready
function runPageAnalysis(): void {
  try {
    if (!chrome.runtime?.id) return; // extension context invalidated

    const currentUrl = window.location.href;
    const domain = window.location.hostname;

    // Skip internal pages
    if (currentUrl.startsWith("chrome") || currentUrl.startsWith("about:") || currentUrl.startsWith("moz-extension")) return;

    // Ask background to check this URL — content script is ready now
    // Background waits for init (lists loaded) before responding, so we always get a correct result.
    // Response includes showDomWarnings to avoid a separate GET_SETTINGS round-trip.
    chrome.runtime.sendMessage(
      { type: "CHECK_URL", url: currentUrl },
      (response: { level?: string; reasons?: string[]; score?: number; showDomWarnings?: boolean } | null) => {
        if (response && (response.level === "DANGEROUS" || response.level === "SUSPICIOUS")) {
          if (response.showDomWarnings !== false) {
            createWarningBanner(response.level!, (response.reasons || []).join(", "));
          }
        }
      },
    );

    const result = analyzePage(document, domain);

    if (result.score > 0) {
      chrome.runtime.sendMessage({
        type: "PAGE_ANALYSIS",
        domain,
        url: currentUrl,
        ...result,
      }).catch(() => {});
    }

    // Check for breach history
    chrome.runtime.sendMessage(
      { type: "CHECK_BREACH", domain },
      (response: { isBreached: boolean; breaches: { name: string; date: string; dataTypes: string[] }[] } | null) => {
        if (response?.isBreached && response.breaches.length > 0) {
          const breach = response.breaches[0];
          const reason = t.breach.detected(breach.name, breach.date, breach.dataTypes.join(", "));
          createBreachInfoBanner(reason);
        }
      },
    );
  } catch {
    // Silently fail - don't break the page
  }
}

chrome.runtime.onMessage.addListener(
  (message: WarningMessage, _sender, sendResponse) => {
    if (message.type === "SHOW_WARNING") {
      createWarningBanner(message.level, message.reason);
      sendResponse({ shown: true });
    }
    if (message.type === "RESCAN") {
      // Lists just finished loading — re-run full analysis
      bannerDismissed = false;
      runPageAnalysis();
      sendResponse({ ok: true });
    }
    return true;
  },
);

// Analyze page content after load
if (document.readyState === "complete") {
  setTimeout(runPageAnalysis, 500);
} else {
  window.addEventListener("load", () => setTimeout(runPageAnalysis, 500));
}

// SPA URL change detection — pushState/replaceState do not fire `load`,
// so the content script would otherwise keep a stale verdict after
// client-side navigation. We cannot patch the page's `history` API from
// here: content scripts run in an isolated world, and property
// assignments on shared DOM objects (like `history`) are not visible to
// the page's own scripts. Injecting a patcher into the main world would
// need `world: "MAIN"` (Firefox needs ≥128; our strict_min is 109) or a
// web-accessible `<script>` payload. A 1 Hz poll is simpler, portable
// across all supported browsers, and carries negligible runtime cost.
let lastAnalyzedUrl = window.location.href;
const URL_POLL_INTERVAL_MS = 1000;

function onUrlMaybeChanged(): void {
  if (window.location.href === lastAnalyzedUrl) return;
  lastAnalyzedUrl = window.location.href;
  bannerDismissed = false; // user-dismissal does not carry across URLs
  // Tear down banners + re-attach observer from the previous URL —
  // otherwise a stale warning persists when the new URL is SAFE, and
  // the orphan observer can re-append a banner into the new page.
  document.getElementById(BANNER_HOST_ID)?.remove();
  document.getElementById(BREACH_BANNER_HOST_ID)?.remove();
  if (bannerObserver) { bannerObserver.disconnect(); bannerObserver = null; }
  runPageAnalysis();
}

// popstate / hashchange fire synchronously; the poll handles
// pushState / replaceState performed by SPA routers.
window.addEventListener("popstate", onUrlMaybeChanged);
window.addEventListener("hashchange", onUrlMaybeChanged);
setInterval(onUrlMaybeChanged, URL_POLL_INTERVAL_MS);
