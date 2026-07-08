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

/**
 * Guvendigim baglantilar (whitelist) icin ek meta. `whitelist: string[]`
 * ana kaynak olarak kalir — hicbir eski kullanim etkilenmez. Yeni bir
 * domain eklenirken, o an ki verdict (SAFE / SUSPICIOUS / DANGEROUS /
 * UNKNOWN) burada da tutulur. Boylece Options listesinde her satirda
 * "onceden ne idi → simdi Guvenli" band'i gosterilebilir.
 *
 * Eski (v0.4.0 oncesi eklenen) kayitlar icin meta olmayabilir; UI o durumda
 * previousLevel'i UNKNOWN olarak varsayar.
 */
export interface WhitelistMeta {
  previousLevel: ThreatLevel;
  addedAt: number;
}

export interface ExtensionSettings {
  protectionLevel: "low" | "medium" | "high";
  notificationsEnabled: boolean;
  whitelist: string[];
  whitelistMeta?: Record<string, WhitelistMeta>;
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
  /**
   * Sag tik menusu — "Alparslan ile Güvenliği Kontrol Et" secenegi. true ise
   * background SW context menu kayit eder, false ise removeAll ile temizler.
   * Toggle anlik etki eder.
   */
  contextMenuEnabled: boolean;
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
  contextMenuEnabled: true,
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
