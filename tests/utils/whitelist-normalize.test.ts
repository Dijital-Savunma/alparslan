// Pure function — no DOM needed. Skip jsdom (broken on this version).
// @vitest-environment node

import { describe, it, expect } from "vitest";
import { normalizeWhitelistInput } from "@/utils/whitelist-normalize";

describe("normalizeWhitelistInput", () => {
  describe("accepts well-formed hosts", () => {
    it.each([
      ["example.com", "example.com"],
      ["Example.COM", "example.com"],
      ["  example.com  ", "example.com"],
      ["www.example.com", "www.example.com"], // www preserved
      ["sub.example.com", "sub.example.com"],
      ["garanti.com.tr", "garanti.com.tr"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeWhitelistInput(input)).toBe(expected);
    });
  });

  describe("normalises URL-shaped input", () => {
    it.each([
      ["https://example.com/", "example.com"],
      ["http://example.com/path/to/page", "example.com"],
      ["https://example.com:8443/", "example.com"],
      ["https://example.com?q=1", "example.com"],
      ["https://example.com#section", "example.com"],
      ["https://www.example.com/login?token=abc", "www.example.com"],
      ["https://www.example.com:8443/login?token=abc", "www.example.com"],
      ["https://login.akbank.com.tr/path", "login.akbank.com.tr"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeWhitelistInput(input)).toBe(expected);
    });
  });

  describe("strips trailing path/query/fragment when no scheme", () => {
    it.each([
      ["example.com/", "example.com"],
      ["example.com/foo/bar", "example.com"],
      ["example.com?x=1", "example.com"],
      ["example.com#frag", "example.com"],
      ["example.com:443", "example.com"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeWhitelistInput(input)).toBe(expected);
    });
  });

  describe("strips leading dot / wildcard prefixes", () => {
    it.each([
      [".example.com", "example.com"],
      ["*.example.com", "example.com"],
      ["..example.com", "example.com"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeWhitelistInput(input)).toBe(expected);
    });
  });

  describe("rejects garbage inputs (returns empty string)", () => {
    it.each([
      [""],
      ["   "],
      ["com"],       // single-label
      [".com"],      // leading-dot single-label
      ["com.tr"],    // compound public suffix
      ["co.uk"],
      ["gov.tr"],
      ["github.io"],
      ["pages.dev"],
      ["blogspot.com"],
      ["https://github.io/"],
      ["https://pages.dev/"],
      ["https://blogspot.com/"],
      ["https://co.uk/"],   // URL-shaped public suffix
      ["http://"],   // malformed URL
      ["://"],
      ["*"],
      ["..."],
    ])("%s → empty", (input) => {
      expect(normalizeWhitelistInput(input)).toBe("");
    });
  });

  describe("allows private-suffix registrable domains", () => {
    it.each([
      ["foo.github.io", "foo.github.io"],
      ["https://foo.pages.dev/path", "foo.pages.dev"],
      ["foo.blogspot.com", "foo.blogspot.com"],
      ["bar.foo.github.io", "bar.foo.github.io"],
    ])("%s → %s", (input, expected) => {
      expect(normalizeWhitelistInput(input)).toBe(expected);
    });
  });
});
