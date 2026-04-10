import type { WeeklyMetrics, ScoreBreakdown, DashboardData } from "./types";
import t from "@/i18n/tr";

const ACTIVITY_THRESHOLD = 20;

export function calculateScore(metrics: WeeklyMetrics): DashboardData {
  const tips: string[] = [];
  const totalPages = metrics.httpsCount + metrics.httpCount;

  let httpsScore = 0;
  if (totalPages > 0) {
    httpsScore = Math.round((metrics.httpsCount / totalPages) * 30);
  }
  if (totalPages > 0 && httpsScore < 30) {
    tips.push(t.tips.insecureHttp);
  }

  let threatAvoidanceScore = 30;
  if (metrics.urlsChecked > 0) {
    const dangerousPenalty = metrics.dangerousSitesVisited * 10;
    const suspiciousPenalty = metrics.suspiciousSitesVisited * 5;
    threatAvoidanceScore = Math.max(
      0,
      30 - dangerousPenalty - suspiciousPenalty
    );
  } else {
    threatAvoidanceScore = 0;
  }
  if (metrics.dangerousSitesVisited > 0) {
    tips.push(t.tips.dangerousSites(metrics.dangerousSitesVisited));
  }
  if (
    metrics.suspiciousSitesVisited > 0 &&
    metrics.dangerousSitesVisited === 0
  ) {
    tips.push(t.tips.suspiciousSites(metrics.suspiciousSitesVisited));
  }

  const activityRatio = Math.min(
    metrics.urlsChecked / ACTIVITY_THRESHOLD,
    1
  );
  const activityScore = Math.round(activityRatio * 20);

  let trackerScore = 0;
  if (metrics.urlsChecked > 0 && metrics.trackersBlocked > 0) {
    trackerScore = 20;
  }
  if (metrics.urlsChecked > 0 && metrics.trackersBlocked === 0) {
    tips.push(t.tips.enableTracker);
  }

  if (metrics.urlsChecked === 0) {
    tips.push(t.tips.notActive);
  }

  const score = Math.min(
    100,
    Math.max(
      0,
      httpsScore + threatAvoidanceScore + activityScore + trackerScore
    )
  );

  const breakdown: ScoreBreakdown = {
    httpsScore,
    threatAvoidanceScore,
    activityScore,
    trackerScore,
  };

  return {
    score,
    breakdown,
    currentWeek: metrics,
    previousWeek: null,
    tips,
  };
}
