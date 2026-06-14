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
      const stored = result.weeklyMetrics as Partial<WeeklyMetrics> | undefined;
      const previousRaw = result.previousWeekMetrics as Partial<WeeklyMetrics> | undefined;
      // Always merge over EMPTY_WEEKLY_METRICS so newly-added fields (like
      // unknownSitesVisited) default to 0 for users with older stored
      // metrics. Without this, `undefined * penalty = NaN` and the score
      // collapses to NaN, which renders as a blank in the popup.
      const previous = previousRaw ? { ...EMPTY_WEEKLY_METRICS, ...previousRaw } : null;

      if (stored && stored.weekStart === currentWeekStart) {
        const current = { ...EMPTY_WEEKLY_METRICS, ...stored };
        resolve({ current, previous });
      } else {
        const newCurrent: WeeklyMetrics = { ...EMPTY_WEEKLY_METRICS, weekStart: currentWeekStart };
        const newPrevious = stored && stored.weekStart && stored.weekStart > 0
          ? { ...EMPTY_WEEKLY_METRICS, ...stored }
          : previous;
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
      const rawStored = result.weeklyMetrics as Partial<WeeklyMetrics> | undefined;
      // Merge stored over EMPTY so newly-added counters default to 0.
      let metrics: WeeklyMetrics | undefined = rawStored
        ? { ...EMPTY_WEEKLY_METRICS, ...rawStored } as WeeklyMetrics
        : undefined;

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
    urlsChecked: m.urlsChecked + 1,
    httpsCount: m.httpsCount + (isHttps ? 1 : 0),
    httpCount: m.httpCount + (isHttp ? 1 : 0),
  }));
}

export async function recordThreatVisit(level: string): Promise<void> {
  // Track DANGEROUS / SUSPICIOUS / UNKNOWN sites — the score penalises all
  // three (UNKNOWN sites are also a risk because the classifier couldn't
  // confidently mark them safe).
  if (level !== "DANGEROUS" && level !== "SUSPICIOUS" && level !== "UNKNOWN") return;

  await updateMetrics((m) => ({
    ...m,
    // Only DANGEROUS / SUSPICIOUS actually count as "threats blocked" — an
    // UNKNOWN classification isn't a confirmed threat.
    threatsBlocked: m.threatsBlocked + (level === "DANGEROUS" || level === "SUSPICIOUS" ? 1 : 0),
    dangerousSitesVisited: m.dangerousSitesVisited + (level === "DANGEROUS" ? 1 : 0),
    suspiciousSitesVisited: m.suspiciousSitesVisited + (level === "SUSPICIOUS" ? 1 : 0),
    unknownSitesVisited: m.unknownSitesVisited + (level === "UNKNOWN" ? 1 : 0),
  }));
}

export async function recordTrackerBlocked(): Promise<void> {
  await updateMetrics((m) => ({
    ...m,
    trackersBlocked: m.trackersBlocked + 1,
  }));
}
