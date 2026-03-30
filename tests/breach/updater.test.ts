// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRemoteBreachDatabase, getBreachApiUrl, setBreachApiUrl } from "@/breach/updater";

vi.mock("@/breach/checker", () => ({
  loadBreachDatabase: vi.fn(),
}));

import { loadBreachDatabase } from "@/breach/checker";

describe("breach updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    setBreachApiUrl("https://api.dijitalsavunma.org/v1/breaches");
  });

  it("fetches and loads breach data on success", async () => {
    const mockBreaches = [
      { domain: "test.com", name: "Test Breach", date: "2025-01", accountsAffected: 1000, dataTypes: ["email"] },
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ breaches: mockBreaches }),
    });

    const count = await fetchRemoteBreachDatabase();
    expect(count).toBe(1);
    expect(loadBreachDatabase).toHaveBeenCalledWith(mockBreaches, false);
  });

  it("returns -1 on HTTP error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const count = await fetchRemoteBreachDatabase();
    expect(count).toBe(-1);
    expect(loadBreachDatabase).not.toHaveBeenCalled();
  });

  it("returns -1 on network error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const count = await fetchRemoteBreachDatabase();
    expect(count).toBe(-1);
  });

  it("returns 0 when response has no breaches array", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "unexpected" }),
    });

    const count = await fetchRemoteBreachDatabase();
    expect(count).toBe(0);
    expect(loadBreachDatabase).not.toHaveBeenCalled();
  });

  it("uses configured API URL", async () => {
    setBreachApiUrl("https://custom.api/breaches");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ breaches: [] }),
    });

    await fetchRemoteBreachDatabase();
    expect(fetch).toHaveBeenCalledWith("https://custom.api/breaches", expect.any(Object));
  });

  it("getBreachApiUrl returns current URL", () => {
    setBreachApiUrl("https://example.com/api");
    expect(getBreachApiUrl()).toBe("https://example.com/api");
  });
});
