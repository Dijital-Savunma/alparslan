// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addDnrBlockRule,
  removeDnrBlockRule,
  syncDnrRulesWithBlacklist,
  clearAllDnrRules,
  getDnrRuleCount,
} from "@/network/dnr-manager";

let addedRules: unknown[] = [];
let removedIds: number[] = [];

beforeEach(() => {
  addedRules = [];
  removedIds = [];

  (globalThis as unknown as { chrome: Record<string, unknown> }).chrome = {
    ...chrome,
    declarativeNetRequest: {
      updateDynamicRules: vi.fn(async (opts: { addRules?: unknown[]; removeRuleIds?: number[] }) => {
        if (opts.addRules) addedRules.push(...opts.addRules);
        if (opts.removeRuleIds) removedIds.push(...opts.removeRuleIds);
      }),
      getDynamicRules: vi.fn(async () => []),
    },
  };
});

describe("addDnrBlockRule", () => {
  it("adds a block rule for a domain", async () => {
    await addDnrBlockRule("evil.com");
    expect(getDnrRuleCount()).toBe(1);
    expect(addedRules.length).toBe(1);
  });

  it("does not add duplicate rules", async () => {
    await addDnrBlockRule("evil.com");
    await addDnrBlockRule("evil.com");
    expect(getDnrRuleCount()).toBe(1);
  });
});

describe("removeDnrBlockRule", () => {
  it("removes an existing rule", async () => {
    await addDnrBlockRule("evil.com");
    await removeDnrBlockRule("evil.com");
    expect(getDnrRuleCount()).toBe(0);
  });

  it("is a no-op for unknown domain", async () => {
    await removeDnrBlockRule("unknown.com");
    expect(getDnrRuleCount()).toBe(0);
  });
});

describe("syncDnrRulesWithBlacklist", () => {
  it("syncs all domains as block rules", async () => {
    await syncDnrRulesWithBlacklist(["evil.com", "phish.com", "scam.org"]);
    expect(getDnrRuleCount()).toBe(3);
  });
});

describe("clearAllDnrRules", () => {
  it("removes all block rules", async () => {
    await addDnrBlockRule("evil.com");
    await addDnrBlockRule("phish.com");

    // Mock getDynamicRules to return existing rules
    (chrome.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 1000, priority: 2, action: { type: "block" }, condition: {} },
      { id: 1001, priority: 2, action: { type: "block" }, condition: {} },
    ]);

    await clearAllDnrRules();
    expect(getDnrRuleCount()).toBe(0);
  });
});
