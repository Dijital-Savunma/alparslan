// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardTab from "@/popup/DashboardTab";
import t from "@/i18n/tr";

describe("DashboardTab", () => {
  // Skor backend'in dashboard.score'undan DEGIL, insightCounts'tan hesaplanir.
  // Reward sistemi sonrasi formul:
  //   100 − tehdit×10 − risk×5 − (ayar kapali?10:0) + safe×1
  //   + (tehdit yoksa +10) + (risk yoksa +5)
  // Mock: 0 tehdit + 1 risk + 0 safe + scan acik
  //   = 100 − 0 − 5 − 0 + 0 + 10 (tehdit yok ödülü) + 0 (risk var)
  //   = 105, tavan 100
  const mockDashboard = {
    score: 100,
    breakdown: { httpsScore: 0, threatAvoidanceScore: 100, activityScore: 0, trackerScore: 0 },
    currentWeek: { urlsChecked: 50, httpsCount: 45, httpCount: 5, threatsBlocked: 0, trackersBlocked: 0, dangerousSitesVisited: 0, suspiciousSitesVisited: 0, unknownSitesVisited: 1, weekStart: Date.now() },
    previousWeek: null,
    tips: [t.tips.notActive],
    insightCounts: {
      uniqueSafe: 0,
      uniqueThreat: 0,
      uniqueUnknown: 1,
      scanOn: true,
    },
  };

  beforeEach(() => {
    chrome.runtime.sendMessage = vi.fn((msg: unknown, cb?: unknown) => {
      const message = msg as { type: string };
      const callback = cb as ((response: unknown) => void) | undefined;
      if (message.type === "GET_DASHBOARD_SCORE" && callback) {
        callback({ dashboard: mockDashboard });
      } else if (message.type === "GET_STATS" && callback) {
        callback({ stats: { urlsChecked: 0, threatsBlocked: 0, trackersBlocked: 0 } });
      } else if (message.type === "GET_HISTORY" && callback) {
        callback({ history: [] });
      } else if (message.type === "GET_SETTINGS" && callback) {
        callback({ settings: { networkMonitoringEnabled: true } });
      }
    }) as unknown as typeof chrome.runtime.sendMessage;
    // chrome.storage.onChanged listener kullaniliyor; minimal stub.
    (globalThis as unknown as { chrome: typeof chrome }).chrome.storage = {
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    } as unknown as typeof chrome.storage;
  });

  it("renders the computed score value", async () => {
    render(<DashboardTab />);
    // Reward sistemi: 0 tehdit (+10 ödül) − 1 risk (5 ceza) = +5 → 105 → cap 100.
    // useCountUp animates 0→100 over 300ms; nihai deger 100.
    await waitFor(() => {
      expect(screen.getByText("100")).toBeDefined();
    }, { timeout: 1000 });
  });

  it("renders the score breakdown panel title", async () => {
    render(<DashboardTab />);
    await waitFor(() => {
      expect(screen.getByText(t.skorBreakdown.title)).toBeDefined();
    });
  });

  it("renders the status message under the ring", async () => {
    // Score 100 (>= 80) → "safe" tier message.
    render(<DashboardTab />);
    await waitFor(() => {
      expect(screen.getByText(t.scoreRing.safeTitle)).toBeDefined();
      expect(screen.getByText(t.scoreRing.safeSubtitle)).toBeDefined();
    });
  });

  it("shows loading state initially", () => {
    chrome.runtime.sendMessage = vi.fn() as unknown as typeof chrome.runtime.sendMessage;
    render(<DashboardTab />);
    expect(screen.getByText(t.loading)).toBeDefined();
  });
});
