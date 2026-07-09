// @vitest-environment node
// Pure verdict logic — no DOM needed. Avoids the jsdom html-encoding-sniffer
// ESM crash that breaks single-file runs.
import { describe, it, expect, vi, beforeEach } from "vitest";

// checkUrl()/checkUrlConfirmed() read these two leaf data sources. Mock them so
// we can simulate the exact condition behind the sahibinden.com bug: a USOM
// Bloom-filter hit for a domain that is NOT confirmed by the USOM API
// (a false positive). checkUrl() trusts the raw Bloom hit; checkUrlConfirmed()
// must confirm against the API and drop the false positive.
vi.mock("@/blocklist/usom-updater", () => ({ usomBloomTest: vi.fn(() => false) }));
vi.mock("@/api/usom/service", () => ({
  checkDomain: vi.fn(async (domain: string) => ({
    domain,
    verdict: false,
    checkedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  })),
}));

import { usomBloomTest } from "@/blocklist/usom-updater";
import { checkDomain } from "@/api/usom/service";
import { checkUrl, checkUrlConfirmed } from "@/detector/url-checker";
import { ThreatLevel } from "@/utils/types";

const FP_URL = "https://sahibinden.com/";

describe("USOM Bloom-filter false-positive confirmation (sahibinden.com regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkDomain).mockImplementation(async (domain) => ({
      domain,
      verdict: false,
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }));
  });

  it("checkUrl() trusts the raw Bloom hit and reports DANGEROUS", () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    // This is exactly why the unconfirmed re-scan path produced a false banner.
    expect(checkUrl(FP_URL).level).toBe(ThreatLevel.DANGEROUS);
  });

  it("checkUrlConfirmed() downgrades a Bloom hit the API cannot confirm (false positive)", async () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    const result = await checkUrlConfirmed(FP_URL);
    expect(result.level).not.toBe(ThreatLevel.DANGEROUS);
    expect(result.level).toBe(ThreatLevel.UNKNOWN);
    expect(result.reasons).not.toContain("USOM tehdit listesinde");
  });

  it("checkUrlConfirmed() keeps DANGEROUS when the API confirms the USOM listing", async () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    vi.mocked(checkDomain).mockImplementation(async (domain) => ({
      domain,
      verdict: true,
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }));
    expect((await checkUrlConfirmed(FP_URL)).level).toBe(ThreatLevel.DANGEROUS);
  });
});
