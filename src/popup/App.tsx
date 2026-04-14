import { useState, useEffect, useCallback } from "react";
import { type ThreatResult, type ExtensionStats, type ExtensionSettings, type ScanHistoryEntry, HISTORY_DISPLAY_LIMIT } from "@/utils/types";
import TabBar, { type TabId } from "./TabBar";
import DashboardTab from "./DashboardTab";
import BreachBadge from "./BreachBadge";
import t from "@/i18n/tr";

type SecurityStatus = "safe" | "dangerous" | "suspicious" | "unknown" | "loading" | "disabled";

const STATUS_CONFIG: Record<Exclude<SecurityStatus, "loading">, { label: string; color: string; bg: string }> = {
  safe: { label: t.status.safe, color: "#16a34a", bg: "#f0fdf4" },
  dangerous: { label: t.status.dangerous, color: "#dc2626", bg: "#fef2f2" },
  suspicious: { label: t.status.suspicious, color: "#d97706", bg: "#fffbeb" },
  unknown: { label: t.status.unknown, color: "#6b7280", bg: "#f9fafb" },
  disabled: { label: t.status.disabled, color: "#9ca3af", bg: "#f3f4f6" },
};

const STATUS_ICONS: Record<Exclude<SecurityStatus, "loading">, string> = {
  safe: "\u2705",
  dangerous: "\uD83D\uDED1",
  suspicious: "\u26A0\uFE0F",
  unknown: "\u2753",
  disabled: "\u23F8\uFE0F",
};

interface InitStatus {
  ready: boolean;
  step: string;
  percent: number;
  steps: { name: string; done: boolean; ms?: number }[];
}

export default function App() {
  const [initStatus, setInitStatus] = useState<InitStatus | null>(null);
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<SecurityStatus>("loading");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [reasons, setReasons] = useState<string[]>([]);
  const [score, setScore] = useState<number>(0);
  const [stats, setStats] = useState<ExtensionStats>({ urlsChecked: 0, threatsBlocked: 0, trackersBlocked: 0 });
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [pageReasons, setPageReasons] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [tabStats, setTabStats] = useState<{
    requestsChecked: number;
    threatsDetected: number;
    requestsBlocked: number;
    domains: string[];
    threats: Array<{ domain: string; level: string; timestamp: number }>;
  } | null>(null);
  const [listStats, setListStats] = useState<{
    blacklistSize: number;
    whitelistSize: number;
  } | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    initTimings: Record<string, number>;
    blacklistSize: number;
    uptime: number;
  } | null>(null);

  const saveSettings = useCallback((updated: ExtensionSettings) => {
    setSettings(updated);
    chrome.storage.sync.set({ settings: updated }, () => {
      chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updated });
    });
  }, []);

  // Poll init status until ready
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function checkInit(): void {
      chrome.runtime.sendMessage({ type: "GET_INIT_STATUS" }, (response: InitStatus | null) => {
        if (response) {
          setInitStatus(response);
          if (response.ready && timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      });
    }

    checkInit();
    timer = setInterval(checkInit, 300);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // Fetch all popup data — re-runs when init becomes ready
  useEffect(() => {
    // Restore persisted enabled state so the toggle reflects reality
    // after closing and reopening the popup.
    chrome.storage.sync.get("enabled", (result) => {
      if (typeof result.enabled === "boolean") setEnabled(result.enabled);
    });

    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response: { stats: ExtensionStats } | null) => {
      if (response?.stats) setStats(response.stats);
    });
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response: { settings: ExtensionSettings } | null) => {
      if (response?.settings) setSettings(response.settings);
    });
    chrome.runtime.sendMessage({ type: "GET_DEBUG_INFO" }, (response: unknown) => {
      const r = response as { initTimings?: Record<string, number>; blacklistSize?: number; uptime?: number } | null;
      if (r?.initTimings) setDebugInfo({ initTimings: r.initTimings, blacklistSize: r.blacklistSize ?? 0, uptime: r.uptime ?? 0 });
    });

    // Get per-tab network stats for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.runtime.sendMessage({ type: "GET_LIST_STATS", tabId }, (response: unknown) => {
          const r = response as {
            blacklistSize?: number; whitelistSize?: number; dynamicWhitelistSize?: number;
            tab?: { requestsChecked: number; threatsDetected: number; requestsBlocked: number; domains: string[]; threats: Array<{ domain: string; level: string; timestamp: number }> };
          } | null;
          if (r) {
            setListStats({ blacklistSize: r.blacklistSize ?? 0, whitelistSize: (r.whitelistSize ?? 0) + (r.dynamicWhitelistSize ?? 0) });
            if (r.tab) setTabStats(r.tab);
          }
        });
      }
    });
  }, [initStatus?.ready]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";
      setUrl(currentUrl);

      if (!enabled) {
        setStatus("disabled");
        return;
      }

      if (!currentUrl || currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
        setStatus("unknown");
        return;
      }

      chrome.runtime.sendMessage(
        { type: "CHECK_URL", url: currentUrl },
        (response: ThreatResult | null) => {
          if (!response) {
            setStatus("unknown");
            return;
          }
          setStatus(response.level.toLowerCase() as SecurityStatus);
          setReasons(response.reasons || []);
          setScore(response.score || 0);
        },
      );

      // Fetch page analysis results
      try {
        const domain = new URL(currentUrl).hostname;
        chrome.runtime.sendMessage(
          { type: "GET_PAGE_ANALYSIS", domain },
          (response: { analysis: { reasons: string[]; score: number } | null } | null) => {
            if (response?.analysis?.reasons?.length) {
              setPageReasons(response.analysis.reasons);
            }
          },
        );
      } catch { /* ignore */ }
    });
  }, [enabled, initStatus?.ready]);

  const handleToggle = (newEnabled: boolean) => {
    setEnabled(newEnabled);
    chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled: newEnabled });
  };

  const loadHistory = () => {
    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (response: { history: ScanHistoryEntry[] } | null) => {
      if (response?.history) setHistory(response.history);
    });
  };

  const handleToggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  };

  const handleClearHistory = () => {
    chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => {
      setHistory([]);
    });
  };


  const config = status === "loading" ? null : STATUS_CONFIG[status];
  const icon = status === "loading" ? "" : STATUS_ICONS[status];
  const displayDomain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url || "\u2014";
    }
  })();

  // Loading screen while lists are being loaded
  if (initStatus && !initStatus.ready) {
    return (
      <div style={{ width: 340, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14 }}>
        <div style={{ padding: "12px 16px", background: "#1e293b", color: "white", display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/icons/icon-48.png" alt="Alparslan" style={{ width: 24, height: 24 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Alparslan</span>
        </div>
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
            {initStatus.step}
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden", marginBottom: 12 }}>
            <div
              style={{
                height: "100%",
                width: initStatus.percent + "%",
                background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
            %{initStatus.percent}
          </div>
          {/* Step checklist */}
          <div style={{ textAlign: "left", display: "inline-block" }}>
            {initStatus.steps.map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: s.done ? "#16a34a" : "#9ca3af", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{s.done ? "\u2713" : "\u25CB"}</span>
                <span>{s.name}</span>
                {s.done && s.ms !== undefined && (
                  <span style={{ fontSize: 10, color: "#b0b5bd" }}>{s.ms}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 340, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: "#1e293b",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/icons/icon-48.png" alt="Alparslan" style={{ width: 24, height: 24 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Alparslan</span>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          <span>{enabled ? t.active : t.passive}</span>
          <div
            onClick={() => handleToggle(!enabled)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: enabled ? "#22c55e" : "#4b5563",
              position: "relative",
              transition: "background 0.2s",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: "white",
                position: "absolute",
                top: 2,
                left: enabled ? 18 : 2,
                transition: "left 0.2s",
              }}
            />
          </div>
        </label>
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "dashboard" ? (
        <DashboardTab />
      ) : activeTab === "settings" ? (
        <div style={{ padding: "12px 16px" }}>
          {settings && (
            <>
              {/* Network Monitoring Toggle */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.settings.networkMonitoring}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{t.settings.networkMonitoringDesc}</div>
                  </div>
                  <div
                    onClick={() => {
                      const updated = { ...settings, networkMonitoringEnabled: !settings.networkMonitoringEnabled };
                      if (!updated.networkMonitoringEnabled) updated.networkBlockingEnabled = false;
                      saveSettings(updated);
                    }}
                    style={{ width: 36, height: 20, borderRadius: 10, background: settings.networkMonitoringEnabled ? "#22c55e" : "#d1d5db", position: "relative", cursor: "pointer" }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 8, background: "white", position: "absolute", top: 2, left: settings.networkMonitoringEnabled ? 18 : 2, transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>

              {/* DOM Warning Toggle */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.settings.domWarnings}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{t.settings.domWarningsDesc}</div>
                  </div>
                  <div
                    onClick={() => saveSettings({ ...settings, showDomWarnings: !settings.showDomWarnings })}
                    style={{ width: 36, height: 20, borderRadius: 10, background: settings.showDomWarnings !== false ? "#22c55e" : "#d1d5db", position: "relative", cursor: "pointer" }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 8, background: "white", position: "absolute", top: 2, left: (settings.showDomWarnings !== false) ? 18 : 2, transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>

              {/* List Stats */}
              {listStats && (
                <div style={{ padding: "8px 0", borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                  <div>{t.settings.blacklistCount(listStats.blacklistSize)}</div>
                  <div>{t.settings.whitelistCount(listStats.whitelistSize)}</div>
                </div>
              )}

              {/* Link to full options */}
              <button
                onClick={() => chrome.runtime.openOptionsPage()}
                style={{ width: "100%", padding: "8px 0", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#374151", fontFamily: "inherit", marginTop: 4 }}
              >
                {t.settings.allSettings}
              </button>
            </>
          )}
        </div>
      ) : (
      <>
      {/* Status */}
      <div
        style={{
          padding: 16,
          background: config?.bg || "#f9fafb",
          borderBottom: `3px solid ${config?.color || "#e5e7eb"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{status === "loading" ? "\u23F3" : icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: config?.color || "#374151" }}>
              {status === "loading" ? t.status.checking : config?.label}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{displayDomain}</div>
          </div>
        </div>

        {score > 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "#e5e7eb",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(score, 100)}%`,
                  background: config?.color || "#6b7280",
                  borderRadius: 2,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {t.dashboard.threat} skoru: {score}/100
            </div>
          </div>
        )}

        {(reasons.length > 0 || pageReasons.length > 0) && (
          <div style={{ marginTop: 10 }}>
            {reasons.map((r, i) => (
              <div
                key={`url-${i}`}
                style={{
                  fontSize: 12,
                  color: "#4b5563",
                  padding: "4px 0",
                  borderTop: i > 0 ? "1px solid #e5e7eb" : undefined,
                }}
              >
                {"\u2022"} {r}
              </div>
            ))}
            {pageReasons.map((r, i) => (
              <div
                key={`page-${i}`}
                style={{
                  fontSize: 12,
                  color: "#7c3aed",
                  padding: "4px 0",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                {"\u2022"} {r}
              </div>
            ))}
          </div>
        )}
      </div>

      <BreachBadge domain={displayDomain} />

      {/* Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "10px 16px",
          background: "white",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <StatItem label={t.dashboard.control} value={stats.urlsChecked} />
        <StatItem label={t.dashboard.threat} value={stats.threatsBlocked} color="#dc2626" />
        <StatItem label={t.dashboard.tracker} value={stats.trackersBlocked} color="#d97706" />
      </div>

      {/* Network Monitoring Stats — per-tab */}
      {tabStats && tabStats.requestsChecked > 0 && (
        <div style={{ padding: "8px 16px", background: "#f0f9ff", borderTop: "1px solid #e0f2fe" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>
            {t.networkStats.title}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 4 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0369a1" }}>{tabStats.requestsChecked}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{t.networkStats.request}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0369a1" }}>{tabStats.domains.length}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{t.networkStats.domain}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#dc2626" }}>{tabStats.threatsDetected}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{t.networkStats.threat}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#ea580c" }}>{tabStats.requestsBlocked}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{t.networkStats.blocked}</div>
            </div>
          </div>
          {tabStats.threats.length > 0 && (
            <div style={{ maxHeight: 60, overflowY: "auto" }}>
              {tabStats.threats.map((t, i) => (
                <div key={i} style={{ fontSize: 10, color: t.level === "DANGEROUS" ? "#dc2626" : "#d97706", padding: "1px 0" }}>
                  {t.domain}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Toggle */}
      <div style={{ padding: "6px 16px", borderTop: "1px solid #e5e7eb" }}>
        <button
          onClick={handleToggleHistory}
          style={{
            width: "100%",
            padding: "6px 0",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#3b82f6",
            fontFamily: "inherit",
          }}
        >
          {showHistory ? t.history.hide : t.history.show}
        </button>
      </div>

      {showHistory && (
        <div style={{ maxHeight: 200, overflowY: "auto", borderTop: "1px solid #e5e7eb" }}>
          {history.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
              {t.history.empty}
            </div>
          ) : (
            <>
              {history.slice(0, HISTORY_DISPLAY_LIMIT).map((entry, i) => (
                <div
                  key={i}
                  style={{
                    padding: "6px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>
                      {entry.domain}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>
                      {new Date(entry.checkedAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      color: entry.level === "SAFE" ? "#166534" : entry.level === "DANGEROUS" ? "#dc2626" : entry.level === "SUSPICIOUS" ? "#d97706" : "#6b7280",
                      background: entry.level === "SAFE" ? "#dcfce7" : entry.level === "DANGEROUS" ? "#fef2f2" : entry.level === "SUSPICIOUS" ? "#fffbeb" : "#f3f4f6",
                    }}
                  >
                    {entry.level === "SAFE" ? t.status.safe : entry.level === "DANGEROUS" ? "Tehlikeli" : entry.level === "SUSPICIOUS" ? t.status.suspicious : t.status.unknown}
                  </span>
                </div>
              ))}
              <div style={{ padding: "6px 16px", textAlign: "center" }}>
                <button
                  onClick={handleClearHistory}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "inherit",
                  }}
                >
                  {t.history.clear}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      </>
      )}

      {/* Footer with debug info */}
      <div
        style={{
          padding: "6px 16px",
          fontSize: 10,
          color: "#9ca3af",
          background: "#f9fafb",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: debugInfo ? 2 : 0 }}>{t.footer}</div>
        {debugInfo && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#b0b5bd" }}>
            <span>init: {debugInfo.initTimings.total ?? "?"}ms</span>
            <span>liste: {debugInfo.blacklistSize}</span>
            <span>uptime: {Math.round(debugInfo.uptime / 1000)}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: color || "#1e293b" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>{label}</div>
    </div>
  );
}
