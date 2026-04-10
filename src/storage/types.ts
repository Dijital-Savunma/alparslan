export interface WhitelistEntry {
  domain: string;
  addedAt: number;
  addedBy: "user" | "import";
}

export interface BlacklistEntry {
  domain: string;
  category: "bank" | "government" | "cargo" | "social" | "other";
  addedAt: string;
  source: string;
}

export interface ListMetadata {
  key: string;
  value: unknown;
}
