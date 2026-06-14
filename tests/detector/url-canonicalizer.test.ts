import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "@/detector/url-canonicalizer";

describe("canonicalizeUrl", () => {
  it("normalizes hostname to lowercase", () => {
    const result = canonicalizeUrl("https://WWW.EXAMPLE.COM/path");

    expect(result.parseError).toBeUndefined();
    expect(result.scheme).toBe("https");
    expect(result.hostname).toBe("www.example.com");
    expect(result.asciiHostname).toBe("www.example.com");
    expect(result.unicodeHostname).toBe("www.example.com");
    expect(result.path).toBe("/path");
  });

  it("removes trailing dots and records that they were present", () => {
    const result = canonicalizeUrl("https://www.example.com./login");

    expect(result.hostname).toBe("www.example.com");
    expect(result.hasTrailingDot).toBe(true);
    expect(result.normalizedUrl).toBe("https://www.example.com/login");
  });

  it("detects credentials in URLs", () => {
    const result = canonicalizeUrl("https://user:pass@example.com/account");

    expect(result.hostname).toBe("example.com");
    expect(result.hasCredentials).toBe(true);
  });

  it("keeps explicit non-default ports", () => {
    const result = canonicalizeUrl("https://example.com:8443/path");

    expect(result.port).toBe("8443");
    expect(result.normalizedUrl).toBe("https://example.com:8443/path");
  });

  it("normalizes default ports through the URL parser", () => {
    const result = canonicalizeUrl("https://example.com:443/path");

    expect(result.port).toBeNull();
    expect(result.normalizedUrl).toBe("https://example.com/path");
  });

  it("classifies non-http schemes as other", () => {
    const result = canonicalizeUrl("data:text/html,<h1>test</h1>");

    expect(result.scheme).toBe("other");
    expect(result.hostname).toBeNull();
    expect(result.path).toBe("text/html,<h1>test</h1>");
  });

  it("detects public IPv4 addresses", () => {
    const result = canonicalizeUrl("http://8.8.8.8/dns");

    expect(result.hostname).toBe("8.8.8.8");
    expect(result.isIpAddress).toBe(true);
    expect(result.isPrivateIp).toBe(false);
  });

  it("detects private IPv4 addresses", () => {
    const result = canonicalizeUrl("http://192.168.1.10/admin");

    expect(result.hostname).toBe("192.168.1.10");
    expect(result.isIpAddress).toBe(true);
    expect(result.isPrivateIp).toBe(true);
  });

  it.each([
    ["http://127.0.0.1/", "127.0.0.1"],
    ["http://10.0.0.5/", "10.0.0.5"],
    ["http://172.16.0.1/", "172.16.0.1"],
    ["http://192.168.1.1/", "192.168.1.1"],
    ["http://169.254.10.20/", "169.254.10.20"],
  ])("detects private or local IPv4 ranges for %s", (url, hostname) => {
    const result = canonicalizeUrl(url);

    expect(result.hostname).toBe(hostname);
    expect(result.isIpAddress).toBe(true);
    expect(result.isPrivateIp).toBe(true);
    expect(result.registrableDomain).toBeNull();
  });

  it("does not treat invalid IPv4-like hostnames as IP addresses", () => {
    const result = canonicalizeUrl("http://999.999.999.999/path");

    expect(result.parseError).toBeDefined();
    expect(result.isIpAddress).toBe(false);
  });

  it("preserves punycode hostnames as ASCII hostnames in the first phase", () => {
    const result = canonicalizeUrl("https://xn--akbank-3ib.com.tr/");

    expect(result.hostname).toBe("xn--akbank-3ib.com.tr");
    expect(result.asciiHostname).toBe("xn--akbank-3ib.com.tr");
    expect(result.unicodeHostname).toBe("xn--akbank-3ib.com.tr");
  });

  it("returns parseError instead of throwing for invalid URLs", () => {
    const result = canonicalizeUrl("not-a-url");

    expect(result.normalizedUrl).toBeNull();
    expect(result.hostname).toBeNull();
    expect(result.parseError).toBeDefined();
  });

  it("computes registrable domain, public suffix, and subdomain for Turkish domains", () => {
    const result = canonicalizeUrl("https://login.akbank.com.tr/");

    expect(result.registrableDomain).toBe("akbank.com.tr");
    expect(result.publicSuffix).toBe("com.tr");
    expect(result.subdomain).toBe("login");
  });

  it("computes registrable domain for multi-label public suffixes", () => {
    const result = canonicalizeUrl("https://sub.example.co.uk/");

    expect(result.registrableDomain).toBe("example.co.uk");
    expect(result.publicSuffix).toBe("co.uk");
    expect(result.subdomain).toBe("sub");
  });

  it.each([
    ["https://foo.github.io/", "foo.github.io", "github.io"],
    ["https://foo.pages.dev/", "foo.pages.dev", "pages.dev"],
    ["https://foo.blogspot.com/", "foo.blogspot.com", "blogspot.com"],
  ])("treats private suffixes as public suffix boundaries for %s", (url, domain, suffix) => {
    const result = canonicalizeUrl(url);

    expect(result.registrableDomain).toBe(domain);
    expect(result.publicSuffix).toBe(suffix);
    expect(result.subdomain).toBeNull();
  });

  it("keeps Public Suffix List fields null for IP addresses", () => {
    const result = canonicalizeUrl("http://127.0.0.1/");

    expect(result.registrableDomain).toBeNull();
    expect(result.publicSuffix).toBeNull();
    expect(result.subdomain).toBeNull();
  });
});
