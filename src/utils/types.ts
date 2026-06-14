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
  networkMonitoringEnabled: boolean;
  networkBlockingEnabled: boolean;
  urlCacheTtlMinutes: number;
  showDomWarnings: boolean;
  darkMode: boolean;
  /**
   * "Konuşma Balonu ile Anlatım": when true, the status panel adds a row
   * showing an Alparslan avatar + a colour-coded speech bubble with a plain-
   * language verdict instead of (just) the technical SAFE/SUSPICIOUS labels.
   */
  speechBubbleEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  protectionLevel: "medium",
  notificationsEnabled: true,
  whitelist: [],
  networkMonitoringEnabled: true,
  networkBlockingEnabled: false,
  urlCacheTtlMinutes: 5,
  showDomWarnings: true,
  darkMode: false,
  speechBubbleEnabled: true,
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

// Hard cap on stored history. Set very high so the "Tarama Geçmişi"
// sayaci normal kullanimda asla tavana takilmaz — yillarca gezinti
// yetmez. Cap'i tamamen kaldirmiyoruz cunku SW init'inde tum history
// RAM'e yukleniyor, sinirsiz birikim uzun vadede yavasligi tetikler.
export const MAX_HISTORY_ENTRIES = 10000;
export const HISTORY_DISPLAY_LIMIT = 50;

export interface ApiConfig {
  listUrl: string;
  updateIntervalMinutes: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  listUrl: "https://cdn.jsdelivr.net/gh/AsabiAlgo/blocklists@main/usom-blocklist.txt",
  updateIntervalMinutes: 360, // 6 saat
};

export interface Message {
  type: string;
  [key: string]: unknown;
}
