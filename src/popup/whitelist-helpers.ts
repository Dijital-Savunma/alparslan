import { canonicalizeUrl } from "@/detector/url-canonicalizer";

/**
 * Normalise a hostname/URL for the popup's quick-add button:
 *   - strip protocol if a URL was pasted
 *   - strip path / query / fragment
 *   - strip a leading "www."
 *   - lowercase
 */
export function normalizeQuickWhitelistDomain(value: string): string {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return "";

  const canonical = canonicalizeUrl(input.includes("://") ? input : `https://${input}`);
  const hostname = canonical.hostname ?? input.split("/")[0].split("?")[0].split("#")[0].split(":")[0];

  return hostname.replace(/^www\./, "");
}

/**
 * Returns true if `domain` matches an entry in the whitelist either exactly
 * or as a subdomain (`api.x.com` matches whitelist entry `x.com`). Domain
 * comparisons are case-sensitive — callers are expected to have normalised
 * both sides via `normalizeQuickWhitelistDomain`.
 */
export function isDomainInWhitelist(domain: string, whitelist: string[]): boolean {
  return whitelist.some((item) => domain === item || domain.endsWith("." + item));
}
