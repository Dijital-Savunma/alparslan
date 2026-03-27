import { describe, it, expect } from "vitest";
import {
  getTrackerDomains,
  getBlockRules,
  getTrackerCount,
  getCategoryCount,
} from "@/privacy/index";

describe("Privacy - Tracker Blocking", () => {
  it("should have tracker domains defined", () => {
    const domains = getTrackerDomains();
    expect(domains.length).toBeGreaterThan(0);
  });

  it("should have unique IDs for each tracker", () => {
    const domains = getTrackerDomains();
    const ids = domains.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should generate block rules for all trackers", () => {
    const rules = getBlockRules();
    const domains = getTrackerDomains();
    expect(rules.length).toBe(domains.length);
  });

  it("should have valid rule structure", () => {
    const rules = getBlockRules();
    for (const rule of rules) {
      expect(rule.id).toBeGreaterThan(0);
      expect(rule.action.type).toBe("block");
      expect(rule.condition.urlFilter).toMatch(/^\|\|/);
      expect(rule.condition.resourceTypes!.length).toBeGreaterThan(0);
    }
  });

  it("should return correct tracker count", () => {
    const count = getTrackerCount();
    const domains = getTrackerDomains();
    expect(count).toBe(domains.length);
  });

  it("should categorize trackers", () => {
    const categories = getCategoryCount();
    expect(Object.keys(categories).length).toBeGreaterThan(0);

    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    expect(total).toBe(getTrackerCount());
  });

  it("should include common trackers", () => {
    const domains = getTrackerDomains().map((d) => d.domain);
    expect(domains).toContain("google-analytics.com");
    expect(domains).toContain("doubleclick.net");
  });
});
