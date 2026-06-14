// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusPanel } from "@/popup/components/StatusPanel";
import type { ExtensionSettings } from "@/utils/types";
import t from "@/i18n/tr";

const baseProps = {
  config: { label: "Güvenli", color: "#16a34a", bg: "rgba(22,163,74,0.05)" },
  displayStatus: "safe" as const,
  displayDomain: "sahibinden.com",
  settings: { speechBubbleEnabled: true } as unknown as ExtensionSettings,
  reasons: [] as string[],
  pageReasons: [] as string[],
  isWhitelisted: false,
  popupWhitelistInput: "",
  setPopupWhitelistInput: () => {},
  handleAddToWhitelist: () => {},
  setShowCloseConfirm: () => {},
  setShowTrustConfirm: () => {},
  enabled: true,
};

describe("StatusPanel speech bubble", () => {
  it("greets the user with the whitelist message for a user-whitelisted site", () => {
    const { container } = render(
      <StatusPanel {...baseProps} isWhitelisted={true} reasons={[t.reasons.whitelisted]} />,
    );
    // Bolding splits the sentence across nodes, so assert on the container text.
    expect(container.textContent).toContain("güvendiğiniz bağlantılara eklediniz");
    expect(container.textContent).toContain("iyi gezintiler");
    // Must NOT claim we scanned it.
    expect(container.textContent).not.toContain("baştan aşağı taradım");
  });

  it("shows the generic scanned-safe message for a non-whitelisted safe site", () => {
    const { container } = render(<StatusPanel {...baseProps} isWhitelisted={false} />);
    expect(container.textContent).toContain("baştan aşağı taradım");
    expect(container.textContent).not.toContain("güvendiğiniz bağlantılara eklediniz");
  });
});
