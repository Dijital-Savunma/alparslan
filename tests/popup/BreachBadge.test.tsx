// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BreachBadge from "@/popup/BreachBadge";

describe("BreachBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders breach warning when domain is breached", async () => {
    chrome.runtime.sendMessage = vi.fn((msg: unknown, cb?: unknown) => {
      const message = msg as { type: string };
      const callback = cb as ((response: unknown) => void) | undefined;
      if (message.type === "CHECK_BREACH" && callback) {
        callback({
          isBreached: true,
          breaches: [{ name: "Test 2021", date: "2021-06", dataTypes: ["email", "sifre"] }],
        });
      }
    }) as unknown as typeof chrome.runtime.sendMessage;
    render(<BreachBadge domain="example.com" />);
    await waitFor(() => {
      expect(screen.getByText(/veri sizintisi/)).toBeDefined();
    });
  });

  it("renders nothing when domain is not breached", async () => {
    chrome.runtime.sendMessage = vi.fn((msg: unknown, cb?: unknown) => {
      const message = msg as { type: string };
      const callback = cb as ((response: unknown) => void) | undefined;
      if (message.type === "CHECK_BREACH" && callback) {
        callback({ isBreached: false, breaches: [] });
      }
    }) as unknown as typeof chrome.runtime.sendMessage;
    const { container } = render(<BreachBadge domain="safe-site.com" />);
    await waitFor(() => {
      expect(container.textContent).toBe("");
    });
  });

  it("renders nothing for empty domain", () => {
    const { container } = render(<BreachBadge domain="" />);
    expect(container.textContent).toBe("");
  });
});
