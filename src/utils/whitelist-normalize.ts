import { canonicalizeUrl, isPublicSuffixHostname } from "@/detector/url-canonicalizer";

/**
 * Normalise a user-typed whitelist entry:
 *   - strip protocol if the user pasted a URL
 *   - strip trailing slash, path, and port
 *   - lowercase + trim
 *   - reject empty / single-label / public-suffix entries
 * Invalid inputs collapse to "" so callers can drop them with a `!value`
 * check.
 */
export function normalizeWhitelistInput(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";

  let host = trimmed;
  if (host.includes("://")) {
    const canonical = canonicalizeUrl(host);
    host = canonical.hostname ?? "";
  } else {
    host = host.split("/")[0].split("?")[0].split("#")[0];
  }

  host = host.split(":")[0];
  host = host.replace(/^(\*\.|\.)+/, "");

  const canonical = canonicalizeUrl(`https://${host}`);
  if (!canonical.hostname || !canonical.hostname.includes(".")) return "";
  if (isPublicSuffixHostname(canonical.hostname)) return "";

  return canonical.hostname;
}
