export interface WeeklyMetrics {
  /** Total URLs checked this week */
  urlsChecked: number;
  /** Threats detected and blocked */
  threatsBlocked: number;
  /** Trackers blocked */
  trackersBlocked: number;
  /** Pages loaded over HTTPS */
  httpsCount: number;
  /** Pages loaded over HTTP (insecure) */
  httpCount: number;
  /** Number of DANGEROUS-level sites visited */
  dangerousSitesVisited: number;
  /** Number of SUSPICIOUS-level sites visited */
  suspiciousSitesVisited: number;
  /** Week start timestamp (Monday 00:00) */
  weekStart: number;
}

export interface ScoreBreakdown {
  /** HTTPS usage ratio score (0-30) */
  httpsScore: number;
  /** Threat avoidance score (0-30) */
  threatAvoidanceScore: number;
  /** Browsing volume score (0-20) -- rewards active protection use */
  activityScore: number;
  /** Tracker blocking score (0-20) */
  trackerScore: number;
}

export interface DashboardData {
  /** Overall safety score 0-100 */
  score: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Current week metrics */
  currentWeek: WeeklyMetrics;
  /** Previous week metrics (for trend comparison) */
  previousWeek: WeeklyMetrics | null;
  /** Human-readable tips based on weakest areas */
  tips: string[];
}

export const EMPTY_WEEKLY_METRICS: WeeklyMetrics = {
  urlsChecked: 0,
  threatsBlocked: 0,
  trackersBlocked: 0,
  httpsCount: 0,
  httpCount: 0,
  dangerousSitesVisited: 0,
  suspiciousSitesVisited: 0,
  weekStart: 0,
};
