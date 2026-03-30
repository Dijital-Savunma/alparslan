// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabBar from "@/popup/TabBar";

describe("TabBar", () => {
  it("renders two tabs", () => {
    render(<TabBar activeTab="status" onTabChange={() => {}} />);
    expect(screen.getByText("Durum")).toBeDefined();
    expect(screen.getByText("Skor")).toBeDefined();
  });

  it("highlights active tab", () => {
    render(<TabBar activeTab="dashboard" onTabChange={() => {}} />);
    const dashboardTab = screen.getByText("Skor");
    expect(dashboardTab.closest("button")?.style.borderBottom).toContain("solid");
  });

  it("calls onTabChange when clicked", () => {
    const handler = vi.fn();
    render(<TabBar activeTab="status" onTabChange={handler} />);
    fireEvent.click(screen.getByText("Skor"));
    expect(handler).toHaveBeenCalledWith("dashboard");
  });
});
