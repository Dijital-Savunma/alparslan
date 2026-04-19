// Bounded fetch helper — reads a response body with a hard size cap
// so a malformed or hostile upstream cannot exhaust service-worker
// memory on a single response.
//
// Returns the decoded text (assumes UTF-8 response bodies, which all
// our list endpoints are). Throws on HTTP error, oversize, or network
// failure — callers typically already wrap in try/catch.

const DEFAULT_TIMEOUT_MS = 30_000;

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

export async function fetchTextWithLimit(
  url: string,
  opts: SafeFetchOptions,
): Promise<{ text: string; contentType: string; bytes: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: opts.headers,
      cache: opts.cache,
      signal: ctrl.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Reject obviously-oversize responses before we read anything.
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const declared = parseInt(contentLength, 10);
      if (Number.isFinite(declared) && declared > opts.maxBytes) {
        throw new Error(`response too large: content-length ${declared} > ${opts.maxBytes}`);
      }
    }

    const contentType = response.headers.get("content-type") ?? "";
    const reader = response.body?.getReader();

    // No streaming body — cap via direct read. Supports both real
    // responses (arrayBuffer) and simple test mocks (text only).
    if (!reader) {
      if (typeof response.arrayBuffer === "function") {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > opts.maxBytes) {
          throw new Error(`response too large: ${buf.byteLength} > ${opts.maxBytes}`);
        }
        return {
          text: new TextDecoder("utf-8", { fatal: false }).decode(buf),
          contentType,
          bytes: buf.byteLength,
        };
      }
      const text = await response.text();
      if (text.length > opts.maxBytes) {
        throw new Error(`response too large: ${text.length} > ${opts.maxBytes}`);
      }
      return { text, contentType, bytes: text.length };
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > opts.maxBytes) {
        await reader.cancel();
        throw new Error(`response too large: streamed ${received} > ${opts.maxBytes}`);
      }
      chunks.push(value);
    }

    const full = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      full.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      text: new TextDecoder("utf-8", { fatal: false }).decode(full),
      contentType,
      bytes: received,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * SHA-256 hex digest of a UTF-8 string.
 *
 * Used for content integrity verification on remote list payloads.
 * Upstream version.json carries a short version tag in `hash`; when it
 * adds a full `sha256` field we verify against it. Locally computed
 * digests are also stored so repeat fetches of the same version tag
 * can be compared across service-worker wakes.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Convenience wrappers around the common size tiers.
export const FETCH_LIMITS = {
  versionJson: 64 * 1024,        // 64 KB — tiny metadata
  whitelistTxt: 2 * 1024 * 1024, // 2 MB
  ugcDomainsTxt: 2 * 1024 * 1024,
  riskyTldsTxt: 256 * 1024,      // 256 KB
  usomBlocklistTxt: 25 * 1024 * 1024, // 25 MB — USOM currently ~10 MB, headroom for growth
  remoteBlocklist: 25 * 1024 * 1024,
} as const;
