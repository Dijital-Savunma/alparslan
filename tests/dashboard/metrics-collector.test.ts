// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWeekStart, collectCurrentWeekMetrics, recordPageProtocol, recordThreatVisit } from "@/dashboard/metrics-collector";
import { EMPTY_WEEKLY_METRICS } from "@/dashboard/types";

// getWeekStart adi backward-compat icin duruyor ama artik GUNLUK
// gun-basi doner ("Gunluk Skor" tarafiyla ayni periyot).
describe("getWeekStart (daily day-start)", () => {
  it("returns 00:00:00 UTC of the same day for a mid-afternoon input", () => {
    const wed = new Date("2026-03-25T14:30:00Z").getTime();
    const dayStart = getWeekStart(wed);
    expect(new Date(dayStart).toISOString()).toBe("2026-03-25T00:00:00.000Z");
  });

  it("returns same instant when input is already at day start", () => {
    const mon = new Date("2026-03-23T00:00:00Z").getTime();
    const dayStart = getWeekStart(mon);
    expect(new Date(dayStart).toISOString()).toBe("2026-03-23T00:00:00.000Z");
  });

  it("returns start of the same Sunday for a Sunday evening", () => {
    const sun = new Date("2026-03-29T20:00:00Z").getTime();
    const dayStart = getWeekStart(sun);
    expect(new Date(dayStart).toISOString()).toBe("2026-03-29T00:00:00.000Z");
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
