// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { checkBreach, loadBreachDatabase, getBreachDatabaseSize } from "@/breach/checker";

const SAMPLE_BREACHES = [
  { domain: "linkedin.com", name: "LinkedIn 2021", date: "2021-06", accountsAffected: 700000000, dataTypes: ["email", "isim"] },
  { domain: "yemeksepeti.com", name: "Yemeksepeti 2021", date: "2021-03", accountsAffected: 21000000, dataTypes: ["email", "telefon"] },
  { domain: "facebook.com", name: "Facebook 2021", date: "2021-04", accountsAffected: 533000000, dataTypes: ["email", "telefon"] },
];

describe("breach checker", () => {
  beforeEach(() => {
    loadBreachDatabase(SAMPLE_BREACHES);
  });

  it("returns isBreached=true for a known breached domain", () => {
    const result = checkBreach("linkedin.com");
    expect(result.isBreached).toBe(true);
    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0].name).toBe("LinkedIn 2021");
  });

  it("returns isBreached=false for unknown domain", () => {
    const result = checkBreach("safe-unknown-site.com");
    expect(result.isBreached).toBe(false);
    expect(result.breaches).toHaveLength(0);
  });

  it("matches root domain from full hostname", () => {
    const result = checkBreach("www.linkedin.com");
    expect(result.isBreached).toBe(true);
  });

  it("matches subdomain of breached domain", () => {
    const result = checkBreach("m.facebook.com");
    expect(result.isBreached).toBe(true);
    expect(result.breaches[0].name).toBe("Facebook 2021");
  });

  it("is case-insensitive", () => {
    const result = checkBreach("LinkedIn.COM");
    expect(result.isBreached).toBe(true);
  });

  it("returns correct database size", () => {
    expect(getBreachDatabaseSize()).toBe(3);
  });

  it("handles empty database", () => {
    loadBreachDatabase([]);
    const result = checkBreach("linkedin.com");
    expect(result.isBreached).toBe(false);
    expect(getBreachDatabaseSize()).toBe(0);
  });

  it("merges new entries without replacing when replace=false", () => {
    loadBreachDatabase(
      [{ domain: "newsite.com", name: "New 2026", date: "2026-01", accountsAffected: 1000, dataTypes: ["email"] }],
      false,
    );
    expect(getBreachDatabaseSize()).toBe(4);
    expect(checkBreach("linkedin.com").isBreached).toBe(true);
    expect(checkBreach("newsite.com").isBreached).toBe(true);
  });

  it("returns multiple breaches for domain with multiple incidents", () => {
    loadBreachDatabase([
      ...SAMPLE_BREACHES,
      { domain: "linkedin.com", name: "LinkedIn 2023", date: "2023-11", accountsAffected: 0, dataTypes: ["email"] },
    ]);
    const result = checkBreach("linkedin.com");
    expect(result.breaches).toHaveLength(2);
  });
});
