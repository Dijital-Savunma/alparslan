import { EMPTY_WEEKLY_METRICS, type WeeklyMetrics } from "./types";

export function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

function getStoredMetrics(): Promise<{ current: WeeklyMetrics; previous: WeeklyMetrics | null }> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["weeklyMetrics", "previousWeekMetrics"], (result) => {
      const currentWeekStart = getWeekStart(Date.now());
      const stored = result.weeklyMetrics as WeeklyMetrics | undefined;
      const previous = (result.previousWeekMetrics as WeeklyMetrics) || null;

      if (stored && stored.weekStart === currentWeekStart) {
        resolve({ current: stored, previous });
      } else {
        const newCurrent: WeeklyMetrics = { ...EMPTY_WEEKLY_METRICS, weekStart: currentWeekStart };
        const newPrevious = stored && stored.weekStart > 0 ? stored : previous;
        chrome.storage.sync.set({ weeklyMetrics: newCurrent, previousWeekMetrics: newPrevious });
        resolve({ current: newCurrent, previous: newPrevious });
      }
    });
  });
}

export async function collectCurrentWeekMetrics(): Promise<WeeklyMetrics> {
  const { current } = await getStoredMetrics();
  return current;
}

export async function collectPreviousWeekMetrics(): Promise<WeeklyMetrics | null> {
  const { previous } = await getStoredMetrics();
  return previous;
}

function updateMetrics(updater: (metrics: WeeklyMetrics) => WeeklyMetrics): Promise<void> {
  return new Promise((resolve) => {
    const currentWeekStart = getWeekStart(Date.now());
    chrome.storage.sync.get(["weeklyMetrics", "previousWeekMetrics"], (result) => {
      let metrics = result.weeklyMetrics as WeeklyMetrics | undefined;

      if (!metrics || metrics.weekStart !== currentWeekStart) {
        const newPrevious = metrics && metrics.weekStart > 0 ? metrics : result.previousWeekMetrics;
        metrics = { ...EMPTY_WEEKLY_METRICS, weekStart: currentWeekStart };
        const updated = updater(metrics);
        chrome.storage.sync.set({ weeklyMetrics: updated, previousWeekMetrics: newPrevious }, resolve);
      } else {
        const updated = updater(metrics);
        chrome.storage.sync.set({ weeklyMetrics: updated }, resolve);
      }
    });
  });
}

export async function recordPageProtocol(url: string): Promise<void> {
  const isHttps = url.startsWith("https://");
  const isHttp = url.startsWith("http://");
  if (!isHttps && !isHttp) return;

  await updateMetrics((m) => ({
    ...m,
    httpsCount: m.httpsCount + (isHttps ? 1 : 0),
    httpCount: m.httpCount + (isHttp ? 1 : 0),
  }));
}

export async function recordThreatVisit(level: string): Promise<void> {
  if (level !== "DANGEROUS" && level !== "SUSPICIOUS") return;

  await updateMetrics((m) => ({
    ...m,
    dangerousSitesVisited: m.dangerousSitesVisited + (level === "DANGEROUS" ? 1 : 0),
    suspiciousSitesVisited: m.suspiciousSitesVisited + (level === "SUSPICIOUS" ? 1 : 0),
  }));
}
