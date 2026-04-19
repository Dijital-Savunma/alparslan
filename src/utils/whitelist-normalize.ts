// Public suffixes that, if allowed as whitelist entries, would disable
// protection for entire TLDs via the list-cache parent-match rule.
// Kept intentionally short — the list-cache parent-match is already
// restricted; this is a UX guard that tells the user "don't do that".
const REJECTED_SUFFIXES: ReadonlySet<string> = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "info", "biz",
  "tr", "uk", "de", "fr", "jp", "kr", "cn", "ru", "it", "es",
  "nl", "be", "io", "co", "me", "xyz", "app", "dev",
  "com.tr", "net.tr", "org.tr", "edu.tr", "gov.tr", "mil.tr",
  "co.uk", "ac.uk", "gov.uk",
]);

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
  // If user pasted a full URL, parse it.
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return "";
    }
  } else {
    // Strip any path / query / fragment if they typed "example.com/foo".
    host = host.split("/")[0].split("?")[0].split("#")[0];
  }
  // Strip port.
  host = host.split(":")[0];
  // Strip leading dots and "*." wildcard prefixes. www is preserved
  // intentionally — some sites only serve on the www subdomain.
  host = host.replace(/^(\*\.|\.)+/, "");
  if (!host.includes(".")) return ""; // bare TLD / single label
  if (REJECTED_SUFFIXES.has(host)) return ""; // public suffix
  return host;
}
