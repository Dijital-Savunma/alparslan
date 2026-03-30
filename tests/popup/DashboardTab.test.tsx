// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardTab from "@/popup/DashboardTab";

describe("DashboardTab", () => {
  const mockDashboard = {
    score: 72,
    breakdown: { httpsScore: 25, threatAvoidanceScore: 27, activityScore: 10, trackerScore: 10 },
    currentWeek: { urlsChecked: 50, httpsCount: 45, httpCount: 5, threatsBlocked: 2, trackersBlocked: 30, dangerousSitesVisited: 0, suspiciousSitesVisited: 1, weekStart: Date.now() },
    previousWeek: null,
    tips: ["Guvenli olmayan (HTTP) sitelere dikkat edin. HTTPS olan alternatifleri tercih edin."],
  };

  beforeEach(() => {
    chrome.runtime.sendMessage = vi.fn((msg: unknown, cb?: unknown) => {
      const message = msg as { type: string };
      const callback = cb as ((response: unknown) => void) | undefined;
      if (message.type === "GET_DASHBOARD_SCORE" && callback) {
        callback({ dashboard: mockDashboard });
      }
    }) as unknown as typeof chrome.runtime.sendMessage;
  });

  it("renders score value", async () => {
    render(<DashboardTab />);
    await waitFor(() => {
      expect(screen.getByText("72")).toBeDefined();
    });
  });

  it("renders score breakdown categories", async () => {
    render(<DashboardTab />);
    await waitFor(() => {
      expect(screen.getAllByText("HTTPS").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Tehdit")).toBeDefined();
      expect(screen.getByText("Aktivite")).toBeDefined();
      expect(screen.getAllByText("Tracker").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders tips when present", async () => {
    render(<DashboardTab />);
    await waitFor(() => {
      expect(screen.getByText(/HTTPS olan alternatifleri/)).toBeDefined();
    });
  });

  it("shows loading state initially", () => {
    chrome.runtime.sendMessage = vi.fn() as unknown as typeof chrome.runtime.sendMessage;
    render(<DashboardTab />);
    expect(screen.getByText("Yukleniyor...")).toBeDefined();
  });
});
