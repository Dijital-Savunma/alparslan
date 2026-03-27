// Alparslan - Tracker blocking module using declarativeNetRequest

export interface TrackerRule {
  id: number;
  domain: string;
  category: "analytics" | "advertising" | "social" | "fingerprint";
}

// Well-known tracker domains
const TRACKER_DOMAINS: TrackerRule[] = [
  { id: 1, domain: "google-analytics.com", category: "analytics" },
  { id: 2, domain: "googletagmanager.com", category: "analytics" },
  { id: 3, domain: "facebook.net", category: "social" },
  { id: 4, domain: "connect.facebook.net", category: "social" },
  { id: 5, domain: "platform.twitter.com", category: "social" },
  { id: 6, domain: "doubleclick.net", category: "advertising" },
  { id: 7, domain: "googlesyndication.com", category: "advertising" },
  { id: 8, domain: "adservice.google.com", category: "advertising" },
  { id: 9, domain: "analytics.tiktok.com", category: "analytics" },
  { id: 10, domain: "pixel.facebook.com", category: "social" },
  { id: 11, domain: "bat.bing.com", category: "analytics" },
  { id: 12, domain: "hotjar.com", category: "analytics" },
  { id: 13, domain: "clarity.ms", category: "analytics" },
  { id: 14, domain: "mc.yandex.ru", category: "analytics" },
  { id: 15, domain: "cdn.amplitude.com", category: "analytics" },
  { id: 16, domain: "cdn.segment.com", category: "analytics" },
  { id: 17, domain: "mixpanel.com", category: "analytics" },
  { id: 18, domain: "sentry.io", category: "analytics" },
  { id: 19, domain: "criteo.com", category: "advertising" },
  { id: 20, domain: "adnxs.com", category: "advertising" },
];

export function getTrackerDomains(): TrackerRule[] {
  return TRACKER_DOMAINS;
}

export function getBlockRules(): chrome.declarativeNetRequest.Rule[] {
  return TRACKER_DOMAINS.map((tracker) => ({
    id: tracker.id,
    priority: 1,
    action: {
      type: "block" as chrome.declarativeNetRequest.RuleActionType,
    },
    condition: {
      urlFilter: `||${tracker.domain}`,
      resourceTypes: [
        "script" as chrome.declarativeNetRequest.ResourceType,
        "image" as chrome.declarativeNetRequest.ResourceType,
        "xmlhttprequest" as chrome.declarativeNetRequest.ResourceType,
        "sub_frame" as chrome.declarativeNetRequest.ResourceType,
      ],
    },
  }));
}

export function getTrackerCount(): number {
  return TRACKER_DOMAINS.length;
}

export function getCategoryCount(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of TRACKER_DOMAINS) {
    counts[t.category] = (counts[t.category] || 0) + 1;
  }
  return counts;
}
