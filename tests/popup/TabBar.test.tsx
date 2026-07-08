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
    // Aktif pill artik absolute-pozitiflenmis ayri bir eleman (kayan
    // animasyon icin); butonlar transparent. Aktif olan mavi metin +
    // font-weight 600, pasif olan muted + 400 ile ayrilir.
    const dashboardTab = screen.getByText("Skor").closest("button");
    const statusTab = screen.getByText("Durum").closest("button");
    expect(dashboardTab?.style.fontWeight).toBe("600");
    expect(statusTab?.style.fontWeight).toBe("400");
    // Renk artik theme.ts'deki --accent-info-bright token'indan gelir;
    // karanlik/aydinlik modda otomatik uyar.
    expect(dashboardTab?.style.color).toBe("var(--accent-info-bright)");
  });

  it("calls onTabChange when clicked", () => {
    const handler = vi.fn();
    render(<TabBar activeTab="status" onTabChange={handler} />);
    fireEvent.click(screen.getByText("Skor"));
    expect(handler).toHaveBeenCalledWith("dashboard");
  });
});
