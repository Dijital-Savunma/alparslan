// Remote blocklist updater — fetches phishing list from API periodically
import { type ApiConfig, DEFAULT_API_CONFIG } from "@/utils/types";
import { loadBlocklist } from "@/detector/url-checker";

const ALARM_NAME = "alparslan-list-update";

let config: ApiConfig = { ...DEFAULT_API_CONFIG };

export function setApiConfig(newConfig: Partial<ApiConfig>): void {
  config = { ...config, ...newConfig };
}

export function getApiConfig(): ApiConfig {
  return config;
}

/**
 * Fetch remote blocklist and merge with built-in list.
 * Returns the number of domains loaded, or -1 on failure.
 */
export async function fetchRemoteBlocklist(): Promise<number> {
  try {
    const response = await fetch(config.listUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[Alparslan] List update failed: HTTP ${response.status}`);
      return -1;
    }

    const data = await response.json();
    const domains: string[] = [];

    // Support both { domains: [{domain: "..."}] } and { domains: ["..."] }
    if (Array.isArray(data.domains)) {
      for (const entry of data.domains) {
        if (typeof entry === "string") {
          domains.push(entry);
        } else if (entry?.domain) {
          domains.push(entry.domain);
        }
      }
    }

    if (domains.length > 0) {
      loadBlocklist(domains);
      console.warn(`[Alparslan] Remote list updated: ${domains.length} domains`);
    }

    return domains.length;
  } catch (err) {
    console.warn("[Alparslan] List update error:", err);
    return -1;
  }
}

/**
 * Submit a site report to the remote API.
 * Fire-and-forget — does not block the caller.
 */
export async function submitReport(report: {
  domain: string;
  url: string;
  reportType: "dangerous" | "safe";
  description: string;
}): Promise<boolean> {
  try {
    const response = await fetch(config.reportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    return response.ok;
  } catch {
    console.warn("[Alparslan] Report submission failed");
    return false;
  }
}

/**
 * Schedule periodic list updates using chrome.alarms.
 */
export function scheduleListUpdates(): void {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1, // first update 1 min after install
    periodInMinutes: config.updateIntervalMinutes,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      fetchRemoteBlocklist();
    }
  });
}
