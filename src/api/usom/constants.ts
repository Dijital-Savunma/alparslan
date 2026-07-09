// Network limits for the USOM API request
export const USOM_API_ENDPOINT = "https://siberguvenlik.gov.tr/api/address/index";
export const USOM_TIMEOUT_MS = 3_000;
export const USOM_MAX_RESPONSE_BYTES = 256 * 1024;

// Cache duration changes according to the verdict type
export const USOM_TTL_MS = {
  listed: 24 * 60 * 60 * 1_000,
  clean: 6 * 60 * 60 * 1_000,
  error: 10 * 60 * 1_000,
} as const;

export const CACHE_CLEANUP_INTERVAL_MS = 60_000;

// Separate database for API verdict cache
export const DB_NAME = "alparslan-usom-api";
export const DB_VERSION = 1;
export const STORE_NAME = "domains";
