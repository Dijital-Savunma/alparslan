import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@/utils/types";

describe("Options - Settings Types", () => {
  it("should have correct default settings", () => {
    expect(DEFAULT_SETTINGS.protectionLevel).toBe("medium");
    expect(DEFAULT_SETTINGS.notificationsEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.whitelist).toEqual([]);
  });

  it("should allow all protection levels", () => {
    const levels: ExtensionSettings["protectionLevel"][] = ["low", "medium", "high"];
    for (const level of levels) {
      const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, protectionLevel: level };
      expect(settings.protectionLevel).toBe(level);
    }
  });

  it("should support whitelist management", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      whitelist: ["example.com", "test.org"],
    };
    expect(settings.whitelist).toHaveLength(2);
    expect(settings.whitelist).toContain("example.com");

    // Add domain
    const updated = { ...settings, whitelist: [...settings.whitelist, "new.com"] };
    expect(updated.whitelist).toHaveLength(3);

    // Remove domain
    const removed = { ...settings, whitelist: settings.whitelist.filter((d) => d !== "example.com") };
    expect(removed.whitelist).toHaveLength(1);
    expect(removed.whitelist).not.toContain("example.com");
  });

  it("should merge partial settings with defaults", () => {
    const partial = { protectionLevel: "high" as const };
    const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...partial };

    expect(merged.protectionLevel).toBe("high");
    expect(merged.notificationsEnabled).toBe(true);
    expect(merged.whitelist).toEqual([]);
  });

  it("should handle empty whitelist", () => {
    const settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
    expect(settings.whitelist).toEqual([]);
  });

  it("should prevent duplicate whitelist entries via logic", () => {
    const whitelist = ["example.com", "test.org"];
    const newDomain = "example.com";

    // This is the logic used in Options component
    const shouldAdd = !whitelist.includes(newDomain);
    expect(shouldAdd).toBe(false);
  });
});
