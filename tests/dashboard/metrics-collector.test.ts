// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWeekStart, collectCurrentWeekMetrics, recordPageProtocol, recordThreatVisit } from "@/dashboard/metrics-collector";
import { EMPTY_WEEKLY_METRICS } from "@/dashboard/types";

describe("getWeekStart", () => {
  it("returns Monday 00:00:00 for a Wednesday", () => {
    const wed = new Date("2026-03-25T14:30:00Z").getTime();
    const weekStart = getWeekStart(wed);
    const date = new Date(weekStart);
    expect(date.getUTCDay()).toBe(1);
    expect(date.getUTCHours()).toBe(0);
    expect(date.getUTCMinutes()).toBe(0);
  });

  it("returns same Monday for a Monday input", () => {
    const mon = new Date("2026-03-23T10:00:00Z").getTime();
    const weekStart = getWeekStart(mon);
    const date = new Date(weekStart);
    expect(date.getUTCDay()).toBe(1);
    expect(date.toISOString().startsWith("2026-03-23")).toBe(true);
  });

  it("returns previous Monday for a Sunday", () => {
    const sun = new Date("2026-03-29T20:00:00Z").getTime();
    const weekStart = getWeekStart(sun);
    const date = new Date(weekStart);
    expect(date.getUTCDay()).toBe(1);
    expect(date.toISOString().startsWith("2026-03-23")).toBe(true);
  });
});

describe("collectCurrentWeekMetrics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty metrics when storage is empty", async () => {
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb({})
    );
    const result = await collectCurrentWeekMetrics();
    expect(result).toEqual(expect.objectContaining({
      urlsChecked: 0,
      httpsCount: 0,
      httpCount: 0,
    }));
  });

  it("returns stored metrics for current week", async () => {
    const weekStart = getWeekStart(Date.now());
    const stored = {
      weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, urlsChecked: 42, httpsCount: 40, httpCount: 2, weekStart },
    };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const result = await collectCurrentWeekMetrics();
    expect(result.urlsChecked).toBe(42);
    expect(result.httpsCount).toBe(40);
  });

  it("resets metrics if stored week is old", async () => {
    const oldWeekStart = getWeekStart(Date.now()) - 7 * 24 * 60 * 60 * 1000;
    const stored = {
      weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, urlsChecked: 100, weekStart: oldWeekStart },
    };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const result = await collectCurrentWeekMetrics();
    expect(result.urlsChecked).toBe(0);
  });
});

describe("recordPageProtocol", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("increments httpsCount for https URL", async () => {
    const weekStart = getWeekStart(Date.now());
    const stored = { weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, httpsCount: 5, weekStart } };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const setSpy = vi.spyOn(chrome.storage.sync, "set").mockImplementation(
      (_items: unknown, cb?: () => void) => cb?.()
    );

    await recordPageProtocol("https://example.com");
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyMetrics: expect.objectContaining({ httpsCount: 6 }) }),
      expect.any(Function),
    );
  });

  it("increments httpCount for http URL", async () => {
    const weekStart = getWeekStart(Date.now());
    const stored = { weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, httpCount: 3, weekStart } };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const setSpy = vi.spyOn(chrome.storage.sync, "set").mockImplementation(
      (_items: unknown, cb?: () => void) => cb?.()
    );

    await recordPageProtocol("http://example.com");
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyMetrics: expect.objectContaining({ httpCount: 4 }) }),
      expect.any(Function),
    );
  });
});

describe("recordThreatVisit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("increments dangerousSitesVisited for DANGEROUS level", async () => {
    const weekStart = getWeekStart(Date.now());
    const stored = { weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, dangerousSitesVisited: 1, weekStart } };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const setSpy = vi.spyOn(chrome.storage.sync, "set").mockImplementation(
      (_items: unknown, cb?: () => void) => cb?.()
    );

    await recordThreatVisit("DANGEROUS");
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyMetrics: expect.objectContaining({ dangerousSitesVisited: 2 }) }),
      expect.any(Function),
    );
  });

  it("increments suspiciousSitesVisited for SUSPICIOUS level", async () => {
    const weekStart = getWeekStart(Date.now());
    const stored = { weeklyMetrics: { ...EMPTY_WEEKLY_METRICS, suspiciousSitesVisited: 0, weekStart } };
    vi.spyOn(chrome.storage.sync, "get").mockImplementation(
      (_keys: unknown, cb: (result: Record<string, unknown>) => void) => cb(stored)
    );
    const setSpy = vi.spyOn(chrome.storage.sync, "set").mockImplementation(
      (_items: unknown, cb?: () => void) => cb?.()
    );

    await recordThreatVisit("SUSPICIOUS");
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ weeklyMetrics: expect.objectContaining({ suspiciousSitesVisited: 1 }) }),
      expect.any(Function),
    );
  });

  it("does nothing for SAFE level", async () => {
    const setSpy = vi.spyOn(chrome.storage.sync, "set");

    await recordThreatVisit("SAFE");
    expect(setSpy).not.toHaveBeenCalled();
  });
});
