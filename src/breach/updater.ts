import type { BreachEntry } from "./types";
import { loadBreachDatabase } from "./checker";

let breachApiUrl = "https://api.dijitalsavunma.org/v1/breaches";

export function setBreachApiUrl(url: string): void {
  breachApiUrl = url;
}

export function getBreachApiUrl(): string {
  return breachApiUrl;
}

export async function fetchRemoteBreachDatabase(): Promise<number> {
  try {
    const response = await fetch(breachApiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn("[Alparslan] Breach DB update failed: HTTP " + String(response.status));
      return -1;
    }

    const data = await response.json();

    if (!Array.isArray(data.breaches)) {
      return 0;
    }

    const entries: BreachEntry[] = data.breaches;
    if (entries.length > 0) {
      loadBreachDatabase(entries, false);
      console.warn("[Alparslan] Breach DB updated: " + String(entries.length) + " entries");
    }

    return entries.length;
  } catch (err) {
    console.warn("[Alparslan] Breach DB update error:", err);
    return -1;
  }
}
