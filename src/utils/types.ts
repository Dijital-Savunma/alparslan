export enum ThreatLevel {
  SAFE = "SAFE",
  DANGEROUS = "DANGEROUS",
  SUSPICIOUS = "SUSPICIOUS",
  UNKNOWN = "UNKNOWN",
}

export interface ThreatResult {
  level: ThreatLevel;
  score: number; // 0-100
  reasons: string[];
  url: string;
  checkedAt: number;
}

export interface BlocklistEntry {
  domain: string;
  category: "bank" | "government" | "cargo" | "social" | "other";
  addedAt: string;
  source: string;
}

export interface ExtensionSettings {
  protectionLevel: "low" | "medium" | "high";
  notificationsEnabled: boolean;
  whitelist: string[];
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  protectionLevel: "medium",
  notificationsEnabled: true,
  whitelist: [],
};

export interface ExtensionStats {
  urlsChecked: number;
  threatsBlocked: number;
  trackersBlocked: number;
}

export const DEFAULT_STATS: ExtensionStats = {
  urlsChecked: 0,
  threatsBlocked: 0,
  trackersBlocked: 0,
};

export interface SiteReport {
  domain: string;
  url: string;
  reportType: "dangerous" | "safe";
  description: string;
  reportedAt: number;
}

export interface ScanHistoryEntry {
  url: string;
  domain: string;
  level: ThreatLevel;
  score: number;
  checkedAt: number;
}

export const MAX_HISTORY_ENTRIES = 50;

export interface ApiConfig {
  listUrl: string;
  reportUrl: string;
  updateIntervalMinutes: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  listUrl: "https://api.dijitalsavunma.org/v1/blocklist",
  reportUrl: "https://api.dijitalsavunma.org/v1/reports",
  updateIntervalMinutes: 360, // 6 saat
};

export interface Message {
  type: string;
  [key: string]: unknown;
}
