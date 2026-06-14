// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Options from "@/options/Options";
import t from "@/i18n/tr";

// Covers the Protection Level section that PR #30 restored. The underlying
// `protectionLevel` setting drives detection thresholds in url-checker.ts, so
// the UI control must stay reachable. These tests guard against it being
// hidden again without anyone noticing.
describe("Options — Protection Level", () => {
  beforeEach(() => {
    chrome.storage.sync.get = ((_keys: unknown, cb: (r: Record<string, unknown>) => void) =>
      cb({})) as typeof chrome.storage.sync.get;
    chrome.runtime.sendMessage = vi.fn() as unknown as typeof chrome.runtime.sendMessage;
    // Footer surum etiketi manifest'ten okunur — test ortaminda mock'la.
    chrome.runtime.getManifest = (() => ({ version: "0.4.0" })) as unknown as typeof chrome.runtime.getManifest;
  });

  it("renders the protection level section with all three levels", () => {
    render(<Options />);
    expect(screen.getByText(t.options.protectionLevel)).toBeDefined();
    expect(screen.getByText(t.protection.low)).toBeDefined();
    expect(screen.getByText(t.protection.medium)).toBeDefined();
    expect(screen.getByText(t.protection.high)).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("persists the chosen level and broadcasts SETTINGS_UPDATED", async () => {
    const setSpy = vi.fn((_items: unknown, cb?: () => void) => cb?.());
    chrome.storage.sync.set = setSpy as unknown as typeof chrome.storage.sync.set;
    const sendSpy = vi.fn();
    chrome.runtime.sendMessage = sendSpy as unknown as typeof chrome.runtime.sendMessage;

    render(<Options />);

    // Radios render in low / medium / high order; pick "high".
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[2]);

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalled();
    });
    const savedArg = setSpy.mock.calls[0][0] as { settings: { protectionLevel: string } };
    expect(savedArg.settings.protectionLevel).toBe("high");
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SETTINGS_UPDATED" }),
    );
    // "Ayarlar kaydedildi" confirmation should surface.
    await waitFor(() => {
      expect(screen.getByText(t.options.settingsSaved)).toBeDefined();
    });
  });
});
