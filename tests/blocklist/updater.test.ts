import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRemoteBlocklist, submitReport, setApiConfig, getApiConfig } from "@/blocklist/updater";

// Mock fetch globally
const fetchMock = vi.fn();
Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });

describe("Blocklist Updater", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("getApiConfig / setApiConfig", () => {
    it("should return default config", () => {
      const config = getApiConfig();
      expect(config.listUrl).toContain("dijitalsavunma");
      expect(config.reportUrl).toContain("dijitalsavunma");
      expect(config.updateIntervalMinutes).toBe(360);
    });

    it("should allow partial config update", () => {
      setApiConfig({ updateIntervalMinutes: 60 });
      expect(getApiConfig().updateIntervalMinutes).toBe(60);
      // Reset
      setApiConfig({ updateIntervalMinutes: 360 });
    });
  });

  describe("fetchRemoteBlocklist", () => {
    it("should fetch and return domain count on success", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          domains: [
            { domain: "phishing1.com" },
            { domain: "phishing2.com" },
          ],
        }),
      });

      const count = await fetchRemoteBlocklist();
      expect(count).toBe(2);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("blocklist"),
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });

    it("should support plain string array format", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          domains: ["evil1.com", "evil2.com", "evil3.com"],
        }),
      });

      const count = await fetchRemoteBlocklist();
      expect(count).toBe(3);
    });

    it("should return -1 on HTTP error", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const count = await fetchRemoteBlocklist();
      expect(count).toBe(-1);
    });

    it("should return -1 on network error", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const count = await fetchRemoteBlocklist();
      expect(count).toBe(-1);
    });

    it("should return 0 when response has empty domains", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ domains: [] }),
      });

      const count = await fetchRemoteBlocklist();
      expect(count).toBe(0);
    });
  });

  describe("submitReport", () => {
    it("should POST report to API", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const result = await submitReport({
        domain: "phishing.com",
        url: "https://phishing.com/login",
        reportType: "dangerous",
        description: "Fake bank login",
      });

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("reports"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("phishing.com"),
        }),
      );
    });

    it("should return false on API error", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const result = await submitReport({
        domain: "test.com",
        url: "https://test.com",
        reportType: "safe",
        description: "",
      });

      expect(result).toBe(false);
    });

    it("should return false on network failure", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));

      const result = await submitReport({
        domain: "test.com",
        url: "https://test.com",
        reportType: "dangerous",
        description: "",
      });

      expect(result).toBe(false);
    });
  });
});
