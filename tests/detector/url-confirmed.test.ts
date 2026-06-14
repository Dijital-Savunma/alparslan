// @vitest-environment node
// Pure verdict logic — no DOM needed. Avoids the jsdom html-encoding-sniffer
// ESM crash that breaks single-file runs.
import { describe, it, expect, vi, beforeEach } from "vitest";

// checkUrl()/checkUrlConfirmed() read these two leaf data sources. Mock them so
// we can simulate the exact condition behind the sahibinden.com bug: a USOM
// Bloom-filter hit for a domain that is NOT actually in the IndexedDB store
// (a false positive). checkUrl() trusts the raw Bloom hit; checkUrlConfirmed()
// must confirm against IndexedDB and drop the false positive.
vi.mock("@/blocklist/usom-updater", () => ({ usomBloomTest: vi.fn(() => false) }));
vi.mock("@/blocklist/indexeddb-store", () => ({ hasDomain: vi.fn(async () => false) }));

import { usomBloomTest } from "@/blocklist/usom-updater";
import { hasDomain } from "@/blocklist/indexeddb-store";
import { checkUrl, checkUrlConfirmed } from "@/detector/url-checker";
import { ThreatLevel } from "@/utils/types";

const FP_URL = "https://sahibinden.com/";

describe("USOM Bloom-filter false-positive confirmation (sahibinden.com regression)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checkUrl() trusts the raw Bloom hit and reports DANGEROUS", () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    // This is exactly why the unconfirmed re-scan path produced a false banner.
    expect(checkUrl(FP_URL).level).toBe(ThreatLevel.DANGEROUS);
  });

  it("checkUrlConfirmed() downgrades a Bloom hit IndexedDB cannot confirm (false positive)", async () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    vi.mocked(hasDomain).mockResolvedValue(false);
    const result = await checkUrlConfirmed(FP_URL);
    expect(result.level).not.toBe(ThreatLevel.DANGEROUS);
    expect(result.level).toBe(ThreatLevel.UNKNOWN);
    expect(result.reasons).not.toContain("USOM tehdit listesinde");
  });

  it("checkUrlConfirmed() keeps DANGEROUS when IndexedDB confirms the USOM listing", async () => {
    vi.mocked(usomBloomTest).mockReturnValue(true);
    vi.mocked(hasDomain).mockResolvedValue(true);
    expect((await checkUrlConfirmed(FP_URL)).level).toBe(ThreatLevel.DANGEROUS);
  });
});
