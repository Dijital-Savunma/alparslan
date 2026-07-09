// Raw response shape returned by the USOM API
export interface UsomApiResponse {
  totalCount: number;
  count: number;
  models: UsomApiModel[];
  page: number;
  pageCount: number;
}

// One address item returned inside the API response
export interface UsomApiModel {
  id: number;
  url: string;
  type: string;
  desc: string;
  source: string;
  date: string;
  criticality_level: number;
  connectiontype: string;
}

export type UsomVerdict = boolean | null;

// Normalized result used by the application
export interface DomainFeatures {
  domain: string;
  verdict: UsomVerdict;
  desc?: string;
  criticality?: number;
}

// Persisted result with cache timestamps
export interface DomainRecord extends DomainFeatures {
  checkedAt: Date;
  expiresAt: Date;
}
