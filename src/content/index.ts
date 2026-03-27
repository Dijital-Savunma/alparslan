// Alparslan - Content Script
import "@/utils/browser-polyfill";
import { analyzePage } from "@/detector/page-analyzer";

const BANNER_HOST_ID = "alparslan-warning-host";

interface WarningMessage {
  type: "SHOW_WARNING";
  level: "DANGEROUS" | "SUSPICIOUS";
  reason: string;
  score: number;
}

function createWarningBanner(level: string, reason: string): void {
  const existing = document.getElementById(BANNER_HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = BANNER_HOST_ID;
  host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483647;";

  const shadow = host.attachShadow({ mode: "closed" });

  const isDangerous = level === "DANGEROUS";
  const bgColor = isDangerous ? "#dc2626" : "#d97706";
  const icon = isDangerous ? "\u26A0\uFE0F" : "\u26A0";
  const title = isDangerous ? "TEHLIKELI SITE" : "SUPPHELI SITE";

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
      .banner-content { display: flex; align-items: center; gap: 12px; flex: 1; }
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
          <div class="banner-title">Alparslan: ${title}</div>
          <div class="banner-reason">${escapeHtml(reason)}</div>
        </div>
      </div>
      <button class="banner-close" id="close-btn">Kapat</button>
    </div>
  `;

  shadow.getElementById("close-btn")?.addEventListener("click", () => host.remove());

  if (document.body) {
    document.body.prepend(host);
  } else {
    document.documentElement.prepend(host);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Run page analysis after DOM is ready
function runPageAnalysis(): void {
  try {
    const domain = window.location.hostname;
    const result = analyzePage(document, domain);

    if (result.score > 0) {
      chrome.runtime.sendMessage({
        type: "PAGE_ANALYSIS",
        domain,
        url: window.location.href,
        ...result,
      });
    }
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
    return true;
  },
);

// Analyze page content after load
if (document.readyState === "complete") {
  runPageAnalysis();
} else {
  window.addEventListener("load", runPageAnalysis);
}

export {};
