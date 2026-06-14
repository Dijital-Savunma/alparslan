// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calculateScore } from "@/dashboard/score-calculator";
import { EMPTY_WEEKLY_METRICS, type WeeklyMetrics } from "@/dashboard/types";
import t from "@/i18n/tr";

describe("calculateScore (unique-domain penalty + reward model)", () => {
  it("starts at 100 with no activity (both clean rewards capped)", () => {
    // Hicbir aktivite yok: +10 (tehdit yok) + 5 (risk yok) = +15 odul ama
    // baslangic zaten 100 oldugu icin tavan 100'de kalir.
    const result = calculateScore(EMPTY_WEEKLY_METRICS);
    expect(result.score).toBe(100);
    expect(result.breakdown.threatAvoidanceScore).toBe(100);
    expect(result.tips).toContain(t.tips.notActive);
  });

  it("1 DANGEROUS visit: -15 penalty + 5 risk-clean reward = 90", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 5,
      dangerousSitesVisited: 1,
    };
    const result = calculateScore(metrics);
    expect(result.score).toBe(90);
    expect(result.tips.some((tip) => tip.includes("tehlikeli"))).toBe(true);
  });

  it("3 SUSPICIOUS visits: -30 penalty + 5 risk-clean reward = 75", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 5,
      suspiciousSitesVisited: 3,
    };
    const result = calculateScore(metrics);
    expect(result.score).toBe(75);
  });

  it("4 UNKNOWN visits: -20 penalty + 10 threat-clean reward = 90", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 10,
      unknownSitesVisited: 4,
    };
    const result = calculateScore(metrics);
    expect(result.score).toBe(90);
  });

  it("mixed activity: no rewards (both buckets have activity)", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 20,
      dangerousSitesVisited: 1, // -15
      suspiciousSitesVisited: 2, // -20
      unknownSitesVisited: 5,    // -25
    };
    // Threats > 0 → no +10 reward; unknowns > 0 → no +5 reward
    const result = calculateScore(metrics);
    expect(result.score).toBe(100 - 15 - 20 - 25);
  });

  it("floors at 20 even when penalties exceed 100", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 200,
      // 20 tehdit * 10 = 200 > 100; +5 risk-clean reward; floor 20
      suspiciousSitesVisited: 20,
    };
    const result = calculateScore(metrics);
    expect(result.score).toBe(20);
  });

  it("perfect state with safe sites caps at 100", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 25,
      httpsCount: 25,
    };
    const result = calculateScore(metrics, { uniqueSafeDomainCount: 5 });
    expect(result.score).toBe(100);
  });

  it("setting off does not negate rewards: -10 + 10 + 5 = 105 capped 100", () => {
    const result = calculateScore(EMPTY_WEEKLY_METRICS, {
      networkMonitoringEnabled: false,
    });
    expect(result.score).toBe(100);
  });

  it("setting on with no activity: rewards push but cap at 100", () => {
    const result = calculateScore(EMPTY_WEEKLY_METRICS, {
      networkMonitoringEnabled: true,
    });
    expect(result.score).toBe(100);
  });

  it("3 suspicious + setting off: -30 -10 + 5 risk-clean = 65", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 10,
      suspiciousSitesVisited: 3,
    };
    const result = calculateScore(metrics, { networkMonitoringEnabled: false });
    expect(result.score).toBe(65);
  });

  it("3 suspicious + 15 safe: -30 + 15 + 5 risk-clean = 90", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 30,
      suspiciousSitesVisited: 3,
    };
    const result = calculateScore(metrics, { uniqueSafeDomainCount: 15 });
    expect(result.score).toBe(90);
  });

  it("safe bonus + rewards cannot push above 100", () => {
    const result = calculateScore(EMPTY_WEEKLY_METRICS, {
      uniqueSafeDomainCount: 50,
    });
    expect(result.score).toBe(100);
  });

  it("clean threat reward only applies when zero threats", () => {
    // 1 dangerous = threats > 0 → no +10 reward; but risk clean → +5
    const m1: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      dangerousSitesVisited: 1,
    };
    expect(calculateScore(m1).score).toBe(100 - 15 + 5); // 90

    // 1 suspicious also counts as threat
    const m2: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      suspiciousSitesVisited: 1,
    };
    expect(calculateScore(m2).score).toBe(100 - 10 + 5); // 95
  });

  it("clean risk reward only applies when zero unknowns", () => {
    const m: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      unknownSitesVisited: 1,
    };
    // 1 unknown = -5; no +5 reward; threat clean → +10 = 105 capped 100
    expect(calculateScore(m).score).toBe(100);

    // 2 unknowns => -10; threat clean +10 = 100; cap not hit
    const m2: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      unknownSitesVisited: 2,
    };
    expect(calculateScore(m2).score).toBe(100);

    // 4 unknowns => -20; threat clean +10 = 90 (no cap)
    const m3: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      unknownSitesVisited: 4,
    };
    expect(calculateScore(m3).score).toBe(90);
  });
});
