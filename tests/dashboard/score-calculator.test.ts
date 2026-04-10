// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calculateScore } from "@/dashboard/score-calculator";
import { EMPTY_WEEKLY_METRICS, type WeeklyMetrics } from "@/dashboard/types";
import t from "@/i18n/tr";

describe("calculateScore", () => {
  it("returns 0 score with empty metrics", () => {
    const result = calculateScore(EMPTY_WEEKLY_METRICS);
    expect(result.score).toBe(0);
    expect(result.breakdown.httpsScore).toBe(0);
    expect(result.breakdown.threatAvoidanceScore).toBe(0);
    expect(result.breakdown.activityScore).toBe(0);
    expect(result.breakdown.trackerScore).toBe(0);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it("returns perfect score for ideal browsing", () => {
    const metrics: WeeklyMetrics = {
      urlsChecked: 100,
      threatsBlocked: 5,
      trackersBlocked: 50,
      httpsCount: 100,
      httpCount: 0,
      dangerousSitesVisited: 0,
      suspiciousSitesVisited: 0,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.score).toBe(100);
    expect(result.breakdown.httpsScore).toBe(30);
    expect(result.breakdown.threatAvoidanceScore).toBe(30);
    expect(result.breakdown.activityScore).toBe(20);
    expect(result.breakdown.trackerScore).toBe(20);
    expect(result.tips).toEqual([]);
  });

  it("penalizes HTTP usage", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 100,
      httpsCount: 50,
      httpCount: 50,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.httpsScore).toBe(15);
    expect(result.tips).toContain(t.tips.insecureHttp);
  });

  it("penalizes visiting dangerous sites", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 50,
      httpsCount: 50,
      httpCount: 0,
      dangerousSitesVisited: 3,
      suspiciousSitesVisited: 2,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.threatAvoidanceScore).toBeLessThan(30);
    expect(result.tips.some((t) => t.includes("tehlikeli"))).toBe(true);
  });

  it("gives partial activity score for low browsing volume", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 5,
      httpsCount: 5,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.activityScore).toBe(5);
  });

  it("caps activity score at 20", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 500,
      httpsCount: 500,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.activityScore).toBe(20);
  });

  it("gives tracker score based on blocking ratio", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 100,
      httpsCount: 100,
      trackersBlocked: 10,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.trackerScore).toBe(20);
  });

  it("gives 0 tracker score when no trackers blocked despite activity", () => {
    const metrics: WeeklyMetrics = {
      ...EMPTY_WEEKLY_METRICS,
      urlsChecked: 100,
      httpsCount: 100,
      trackersBlocked: 0,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.breakdown.trackerScore).toBe(0);
    expect(result.tips).toContain(t.tips.enableTracker);
  });

  it("clamps total score between 0 and 100", () => {
    const metrics: WeeklyMetrics = {
      urlsChecked: 1000,
      threatsBlocked: 500,
      trackersBlocked: 1000,
      httpsCount: 1000,
      httpCount: 0,
      dangerousSitesVisited: 0,
      suspiciousSitesVisited: 0,
      weekStart: Date.now(),
    };
    const result = calculateScore(metrics);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
