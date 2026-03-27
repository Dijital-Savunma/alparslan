import { describe, it, expect } from "vitest";
import { ThreatLevel } from "@/utils/types";

describe("ThreatLevel enum", () => {
  it("should have all expected values", () => {
    expect(ThreatLevel.SAFE).toBe("SAFE");
    expect(ThreatLevel.DANGEROUS).toBe("DANGEROUS");
    expect(ThreatLevel.SUSPICIOUS).toBe("SUSPICIOUS");
    expect(ThreatLevel.UNKNOWN).toBe("UNKNOWN");
  });

  it("should have exactly 4 values", () => {
    const values = Object.values(ThreatLevel);
    expect(values).toHaveLength(4);
  });
});
