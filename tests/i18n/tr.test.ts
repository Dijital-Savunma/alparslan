import { describe, it, expect } from "vitest";
import t from "@/i18n/tr";

describe("speechBubble.whitelisted", () => {
  it("is a distinct, domain-aware greeting for user-whitelisted sites", () => {
    const domain = "sahibinden.com";
    const msg = t.speechBubble.whitelisted(domain);

    expect(msg).toContain(domain);
    // StatusPanel bolds this exact keyword as the highlight word — it must be present.
    expect(msg).toContain("iyi gezintiler");
    // Must NOT reuse the generic "we scanned it top to bottom" safe copy.
    expect(msg).not.toEqual(t.speechBubble.safe(domain));
    expect(msg).not.toContain("taradım");
  });
});
