// Remote blocklist updater — fetches phishing list from API periodically
import { type ApiConfig, DEFAULT_API_CONFIG } from "@/utils/types";
import { addToBlacklist } from "@/storage/list-cache";
import type { BlacklistEntry } from "@/storage/types";
import { logger } from "@/utils/logger";

const ALARM_NAME = "alparslan-list-update";

let config: ApiConfig = { ...DEFAULT_API_CONFIG };

export function setApiConfig(newConfig: Partial<ApiConfig>): void {
  config = { ...config, ...newConfig };
}

export function getApiConfig(): ApiConfig {
  return config;
}

/**
 * Parse domains from response — supports plain text (one domain per line)
 * and JSON formats ({ domains: [...] }).
 */
function parseDomains(text: string, contentType: string): string[] {
  const domains: string[] = [];

  // Try JSON first if content-type suggests it
  if (contentType.includes("json")) {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.domains)) {
        for (const entry of data.domains) {
          if (typeof entry === "string") domains.push(entry.trim());
          else if (entry?.domain) domains.push(entry.domain.trim());
        }
      }
      return domains.filter((d) => d.length > 0);
    } catch { /* fall through to plain text */ }
  }

  // Plain text: one domain per line, skip comments (#) and empty lines
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      domains.push(trimmed);
    }
  }
  return domains;
}

/**
 * Fetch remote blocklist and merge with built-in list.
 * Supports plain text (one domain per line) and JSON formats.
 * Returns the number of domains loaded, or -1 on failure.
 */
export async function fetchRemoteBlocklist(): Promise<number> {
  const t0 = Date.now();
  try {
    logger.debug(`Fetching blocklist from: ${config.listUrl}`);
    const response = await fetch(config.listUrl);
    const fetchMs = Date.now() - t0;

    if (!response.ok) {
      logger.warn(`List update failed: HTTP ${response.status} (${fetchMs}ms)`);
      return -1;
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const downloadMs = Date.now() - t0;
    const sizeKb = (text.length / 1024).toFixed(1);
    logger.debug(`Blocklist downloaded: ${sizeKb}KB in ${downloadMs}ms (content-type: ${contentType})`);

    const domains = parseDomains(text, contentType);
    const parseMs = Date.now() - t0 - downloadMs;

    if (domains.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const entries: BlacklistEntry[] = domains.map((d) => ({
        domain: d,
        category: "other" as const,
        addedAt: today,
        source: "remote",
      }));
      await addToBlacklist(entries);
      const totalMs = Date.now() - t0;
      logger.debug(`Remote list updated: ${domains.length} domains (download: ${downloadMs}ms, parse: ${parseMs}ms, save: ${totalMs - downloadMs - parseMs}ms, total: ${totalMs}ms)`);
    } else {
      logger.warn(`Remote list empty or could not parse (${text.length} bytes, content-type: ${contentType})`);
    }

    return domains.length;
  } catch (err) {
    const elapsed = Date.now() - t0;
    logger.warn(`List update error after ${elapsed}ms:`, err);
    return -1;
  }
}


/**
 * Schedule periodic list updates using chrome.alarms.
 */
export function scheduleListUpdates(): void {
  if (chrome.alarms) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: config.updateIntervalMinutes,
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) fetchRemoteBlocklist();
    });
  } else {
    setTimeout(() => fetchRemoteBlocklist(), 60_000);
    setInterval(() => fetchRemoteBlocklist(), config.updateIntervalMinutes * 60_000);
  }
}
