import { describe, it, expect } from "vitest";

describe("Browser Polyfill", () => {
  it("should have chrome defined in test environment", () => {
    expect(typeof chrome).toBe("object");
    expect(chrome.runtime).toBeDefined();
    expect(chrome.storage).toBeDefined();
  });

  it("should not throw when imported", async () => {
    await expect(import("@/utils/browser-polyfill")).resolves.not.toThrow();
  });
});
