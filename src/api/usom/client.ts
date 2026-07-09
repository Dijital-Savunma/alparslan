import { fetchTextWithLimit } from "@/utils/safe-fetch";
import {
  USOM_API_ENDPOINT,
  USOM_MAX_RESPONSE_BYTES,
  USOM_TIMEOUT_MS,
} from "./constants";
import type { DomainFeatures, UsomApiModel, UsomApiResponse } from "./types";

// Helper functions for validating unknown API data
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUsomModel(value: unknown): value is UsomApiModel {
  return (
    isObject(value) &&
    typeof value.id === "number" &&
    typeof value.url === "string" &&
    typeof value.type === "string" &&
    typeof value.desc === "string" &&
    typeof value.source === "string" &&
    typeof value.date === "string" &&
    typeof value.criticality_level === "number" &&
    typeof value.connectiontype === "string"
  );
}

// Validate the response before using it in the application
function parseUsomResponse(value: unknown): UsomApiResponse {
  if (
    !isObject(value) ||
    typeof value.totalCount !== "number" ||
    typeof value.count !== "number" ||
    !Array.isArray(value.models) ||
    typeof value.page !== "number" ||
    typeof value.pageCount !== "number" ||
    value.count < 0
  ) {
    throw new Error("USOM API returned an invalid response");
  }

  return {
    totalCount: value.totalCount,
    count: value.count,
    models: value.models.filter(isUsomModel),
    page: value.page,
    pageCount: value.pageCount,
  };
}

// Send a bounded request to the USOM address endpoint
async function queryAddress(input: string): Promise<UsomApiResponse> {
  const url = new URL(USOM_API_ENDPOINT);
  url.searchParams.set("q", input);

  const { text } = await fetchTextWithLimit(url.href, {
    maxBytes: USOM_MAX_RESPONSE_BYTES,
    timeoutMs: USOM_TIMEOUT_MS,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("USOM API returned malformed JSON");
  }

  return parseUsomResponse(payload);
}

// Convert the API response into the internal verdict format
export async function queryUsom(domain: string): Promise<DomainFeatures> {
  const result = await queryAddress(domain);
  const firstModel = result.models[0];

  if (result.count === 0) {
    return { domain, verdict: false };
  }

  return {
    domain,
    verdict: true,
    ...(firstModel
      ? {
        desc: firstModel.desc,
        criticality: firstModel.criticality_level,
      }
      : {}),
  };
}
