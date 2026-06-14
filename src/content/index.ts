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
  const title = isDangerous ? t.banner.dangerous : t.banner.suspicious;
  // Friendly assistant body \u2014 replaces the raw technical reason ("USOM tehdit
  // listesinde" vb.) with a sentence telling the user what to actually do.
  const body = isDangerous ? t.banner.dangerousBody : t.banner.suspiciousBody;
  const logoUrl = chrome.runtime.getURL("icons/alparslan_logo.svg");

  shadow.innerHTML = `
    <style>
      .banner {
        font-family: system-ui, -apple-system, sans-serif;
        background: ${bgColor};
        color: white;
        padding: 12px 110px;
        text-align: center;
        position: relative;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
      }
      .banner-titlerow {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      .banner-logo {
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        /* Logoyu dogrudan bannerin uzerinde goster — beyaz daire yok, miger
           ikonun kendi formu okunsun. */
      }
      .banner-title { font-weight: 700; font-size: 15px; letter-spacing: 0.2px; }
      .banner-reason { font-size: 12.5px; opacity: 0.95; margin-top: 4px; line-height: 1.4; max-width: 720px; margin-left: auto; margin-right: auto; }
      .banner-close {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255,255,255,0.2);
        border: none; color: white;
        padding: 6px 14px; border-radius: 6px;
        cursor: pointer; font-size: 13px; font-family: inherit;
        transition: background 0.15s ease;
      }
      .banner-close:hover { background: rgba(255,255,255,0.32); }
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    </style>
    <div class="banner" role="alert">
      <div class="banner-titlerow">
        <img src="${logoUrl}" class="banner-logo" alt="Alparslan" />
        <span class="banner-title">${title}</span>
      </div>
      <div class="banner-reason">${escapeHtml(body)}</div>
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

// Storage key used to remember which domains the user explicitly silenced the
// breach banner for. The list is in chrome.storage.local so it survives
// reloads and applies cross-tab.
const BREACH_DISMISSED_KEY = "alparslan-breach-dismissed-domains";

function isBreachDismissedForDomain(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get([BREACH_DISMISSED_KEY], (result) => {
      const list = (result[BREACH_DISMISSED_KEY] as string[] | undefined) || [];
      resolve(list.includes(domain));
    });
  });
}

// @mertinkos review yorumu: content script'in chrome.storage.local'a
// direkt yazmasi mimari acidan tehlikeli (injection riski). Yazma
// background'a tasindi; content script artik DISMISS_BREACH_DOMAIN
// mesajini gonderir, background validate edip yazar.
function rememberBreachDismissal(domain: string): void {
  chrome.runtime.sendMessage({ type: "DISMISS_BREACH_DOMAIN", domain });
}

function createBreachInfoBanner(reason: string, domain: string): void {
  const existing = document.getElementById(BREACH_BANNER_HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = BREACH_BANNER_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; bottom: 0; left: 0; width: 100%; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = [
    ".breach-banner { font-family: system-ui, -apple-system, sans-serif; background: #1e40af; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; box-shadow: 0 -2px 8px rgba(0,0,0,0.2); animation: slideUp 0.3s ease-out; }",
    ".breach-content { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }",
    ".breach-icon { font-size: 18px; flex-shrink: 0; }",
    ".breach-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }",
    ".breach-btn { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.18); color: white; padding: 5px 11px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease; }",
    ".breach-btn:hover { background: rgba(255,255,255,0.32); border-color: rgba(255,255,255,0.40); }",
    ".breach-btn.secondary { background: transparent; border-color: rgba(255,255,255,0.35); }",
    ".breach-btn.secondary:hover { background: rgba(255,255,255,0.14); }",
    "@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }",
    /* Confirmation modal */
    ".confirm-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; font-family: system-ui, -apple-system, sans-serif; }",
    ".confirm-backdrop.open { opacity: 1; pointer-events: auto; }",
    ".confirm-card { background: #ffffff; border-radius: 14px; padding: 22px; max-width: 380px; width: 100%; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.30); transform: scale(0.94); transition: transform 0.2s ease; box-sizing: border-box; }",
    ".confirm-backdrop.open .confirm-card { transform: scale(1); }",
    ".confirm-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 10px; }",
    ".confirm-body { font-size: 13px; line-height: 1.55; color: #64748b; margin: 0 0 20px; }",
    ".confirm-actions { display: flex; gap: 8px; }",
    ".confirm-btn { flex: 1; padding: 10px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.15s ease; }",
    ".confirm-btn.primary { background: #2563eb; color: #ffffff; border: none; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.30); }",
    ".confirm-btn.primary:hover { background: #1d4ed8; transform: scale(1.03); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.40); }",
    ".confirm-btn.muted { background: transparent; color: #64748b; border: 1px solid #cbd5e1; }",
    ".confirm-btn.muted:hover { background: #f1f5f9; color: #1e293b; border-color: #94a3b8; transform: scale(1.03); }",
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

  // Action group \u2014 primary "Kapat" closes for this session, secondary
  // "Kapat ve bir daha g\u00F6sterme" persists the dismissal in storage so this
  // domain never shows the banner again across visits / tabs / restarts.
  const actions = document.createElement("div");
  actions.className = "breach-actions";

  const closeBtn = document.createElement("button");
  closeBtn.className = "breach-btn";
  closeBtn.textContent = t.breach.closeOnce;
  closeBtn.addEventListener("click", () => host.remove());
  actions.appendChild(closeBtn);

  const muteBtn = document.createElement("button");
  muteBtn.className = "breach-btn secondary";
  muteBtn.textContent = t.breach.dontShowAgain;
  actions.appendChild(muteBtn);

  banner.appendChild(actions);

  shadow.appendChild(banner);

  // Confirmation modal — Vazgeç is the dominant filled-blue button (so a
  // reflexive tap keeps the safety net), Evet is the muted outlined button
  // (user has to deliberately reach for it). Lives inside the same shadow
  // root as the banner so style isolation is shared.
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";

  const card = document.createElement("div");
  card.className = "confirm-card";

  const cardTitle = document.createElement("div");
  cardTitle.className = "confirm-title";
  cardTitle.textContent = t.breach.dismissConfirmTitle;
  card.appendChild(cardTitle);

  const cardBody = document.createElement("div");
  cardBody.className = "confirm-body";
  cardBody.textContent = t.breach.dismissConfirmBody(domain);
  card.appendChild(cardBody);

  const cardActions = document.createElement("div");
  cardActions.className = "confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn primary";
  cancelBtn.textContent = t.breach.dismissConfirmCancel;
  cancelBtn.addEventListener("click", () => {
    backdrop.classList.remove("open");
  });
  cardActions.appendChild(cancelBtn);

  const yesBtn = document.createElement("button");
  yesBtn.className = "confirm-btn muted";
  yesBtn.textContent = t.breach.dismissConfirmYes;
  yesBtn.addEventListener("click", () => {
    rememberBreachDismissal(domain);
    backdrop.classList.remove("open");
    host.remove();
  });
  cardActions.appendChild(yesBtn);

  card.appendChild(cardActions);
  backdrop.appendChild(card);
  shadow.appendChild(backdrop);

  // Tapping outside the card dismisses the modal (cancel-equivalent).
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.remove("open");
  });

  muteBtn.addEventListener("click", () => {
    backdrop.classList.add("open");
  });

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
      async (response: { isBreached: boolean; breaches: { name: string; date: string; dataTypes: string[] }[] } | null) => {
        if (!response?.isBreached || response.breaches.length === 0) return;
        // Skip the banner entirely if the user previously chose "bir daha
        // gösterme" for this domain.
        if (await isBreachDismissedForDomain(domain)) return;
        const breach = response.breaches[0];
        const reason = t.breach.detected(breach.name, breach.date, breach.dataTypes.join(", "));
        createBreachInfoBanner(reason, domain);
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
