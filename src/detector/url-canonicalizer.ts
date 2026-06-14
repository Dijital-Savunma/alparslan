import { parse as parseTld } from "tldts";

export type UrlScheme = "http" | "https" | "other";

export interface CanonicalUrl {
  originalUrl: string;
  normalizedUrl: string | null;
  scheme: UrlScheme;
  hostname: string | null;
  asciiHostname: string | null;
  unicodeHostname: string | null;
  registrableDomain: string | null;
  publicSuffix: string | null;
  subdomain: string | null;
  path: string | null;
  port: string | null;
  isIpAddress: boolean;
  isPrivateIp: boolean;
  hasCredentials: boolean;
  hasTrailingDot: boolean;
  parseError?: string;
}

function emptyCanonicalUrl(originalUrl: string, parseError: string): CanonicalUrl {
  return {
    originalUrl,
    normalizedUrl: null,
    scheme: "other",
    hostname: null,
    asciiHostname: null,
    unicodeHostname: null,
    registrableDomain: null,
    publicSuffix: null,
    subdomain: null,
    path: null,
    port: null,
    isIpAddress: false,
    isPrivateIp: false,
    hasCredentials: false,
    hasTrailingDot: false,
    parseError,
  };
}

function getScheme(protocol: string): UrlScheme {
  if (protocol === "http:") return "http";
  if (protocol === "https:") return "https";
  return "other";
}

function stripTrailingDots(hostname: string): string {
  return hostname.replace(/\.+$/u, "");
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d+$/u.test(part)) return Number.NaN;
    if (part.length > 1 && part.startsWith("0")) return Number.NaN;
    return Number(part);
  });

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function normalizeHref(parsed: URL, normalizedHostname: string | null): string {
  const normalized = new URL(parsed.href);

  if (normalizedHostname && normalized.hostname !== normalizedHostname) {
    normalized.hostname = normalizedHostname;
  }

  return normalized.href;
}

function getDomainParts(hostname: string | null, isIpAddress: boolean): Pick<
  CanonicalUrl,
  "registrableDomain" | "publicSuffix" | "subdomain"
> {
  if (!hostname || isIpAddress) {
    return { registrableDomain: null, publicSuffix: null, subdomain: null };
  }

  const parsedDomain = parseTld(hostname, {
    allowPrivateDomains: true,
    extractHostname: false,
  });

  return {
    registrableDomain: parsedDomain.domain ?? null,
    publicSuffix: parsedDomain.publicSuffix ?? null,
    subdomain: parsedDomain.subdomain || null,
  };
}

export function isPublicSuffixHostname(hostname: string): boolean {
  const canonical = canonicalizeUrl(`https://${hostname}`);

  return (
    canonical.parseError === undefined &&
    canonical.hostname !== null &&
    canonical.publicSuffix === canonical.hostname &&
    canonical.registrableDomain === null
  );
}

export function canonicalizeUrl(rawUrl: string): CanonicalUrl {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return emptyCanonicalUrl(rawUrl, error instanceof Error ? error.message : "Invalid URL");
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hasTrailingDot = rawHostname.endsWith(".");
  const hostname = rawHostname ? stripTrailingDots(rawHostname) : null;
  const ipv4 = hostname ? parseIpv4(hostname) : null;
  const isIpAddress = ipv4 !== null;
  const domainParts = getDomainParts(hostname, isIpAddress);

  return {
    originalUrl: rawUrl,
    normalizedUrl: normalizeHref(parsed, hostname),
    scheme: getScheme(parsed.protocol),
    hostname,
    asciiHostname: hostname,
    unicodeHostname: hostname,
    registrableDomain: domainParts.registrableDomain,
    publicSuffix: domainParts.publicSuffix,
    subdomain: domainParts.subdomain,
    path: parsed.pathname,
    port: parsed.port || null,
    isIpAddress,
    isPrivateIp: ipv4 ? isPrivateIpv4(ipv4) : false,
    hasCredentials: parsed.username.length > 0 || parsed.password.length > 0,
    hasTrailingDot,
  };
}
