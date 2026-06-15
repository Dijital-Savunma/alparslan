import type { Page } from "@playwright/test";

export interface CheckUrlResult {
  level: "SAFE" | "SUSPICIOUS" | "DANGEROUS" | "UNKNOWN";
  score: number;
  reasons: string[];
  url: string;
  checkedAt: number;
}

export interface ScanHistoryEntry {
  url: string;
  domain: string;
  level: CheckUrlResult["level"];
  score: number;
  checkedAt: number;
}

export interface ListStats {
  whitelistSize: number;
  blacklistSize: number;
  dynamicWhitelistSize: number;
}

export async function sendRuntimeMessage<T>(
  page: Page,
  message: Record<string, unknown>,
): Promise<T> {
  return page.evaluate(
    (msg) =>
      new Promise<T>((resolve) => {
        chrome.runtime.sendMessage(msg, (response: T) => {
          if (chrome.runtime.lastError) return;
          resolve(response);
        });
      }),
    message,
  );
}

export async function checkUrl(page: Page, url: string): Promise<CheckUrlResult> {
  return sendRuntimeMessage<CheckUrlResult>(page, { type: "CHECK_URL", url });
}

export async function getListStats(page: Page): Promise<ListStats> {
  return sendRuntimeMessage<ListStats>(page, { type: "GET_LIST_STATS" });
}

export async function getHistory(page: Page): Promise<ScanHistoryEntry[]> {
  const response = await sendRuntimeMessage<{ history: ScanHistoryEntry[] }>(page, {
    type: "GET_HISTORY",
  });
  return response.history;
}

export async function clearHistory(page: Page): Promise<void> {
  await sendRuntimeMessage<{ ok: boolean }>(page, { type: "CLEAR_HISTORY" });
}

export async function removeFromWhitelist(
  page: Page,
  domain: string,
): Promise<void> {
  await sendRuntimeMessage<{ ok: boolean }>(page, {
    type: "REMOVE_FROM_WHITELIST",
    domain,
  });
}

export async function setHeuristics(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((heuristicsEnabled) => new Promise<void>((resolve) => {
    chrome.storage.sync.get(["settings"], (r) => {
      const settings = { ...(r.settings as Record<string, unknown> ?? {}), heuristicsEnabled };
      chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings }, () => resolve());
    });
  }), enabled);
}
