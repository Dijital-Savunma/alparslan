import { useState, useEffect } from "react";
import type { ThreatResult, ExtensionStats, ScanHistoryEntry } from "@/utils/types";

type SecurityStatus = "safe" | "dangerous" | "suspicious" | "unknown" | "loading" | "disabled";

const STATUS_CONFIG: Record<Exclude<SecurityStatus, "loading">, { label: string; color: string; bg: string }> = {
  safe: { label: "Guvenli", color: "#16a34a", bg: "#f0fdf4" },
  dangerous: { label: "Tehlikeli!", color: "#dc2626", bg: "#fef2f2" },
  suspicious: { label: "Suppheli", color: "#d97706", bg: "#fffbeb" },
  unknown: { label: "Bilinmiyor", color: "#6b7280", bg: "#f9fafb" },
  disabled: { label: "Koruma Kapali", color: "#9ca3af", bg: "#f3f4f6" },
};

const STATUS_ICONS: Record<Exclude<SecurityStatus, "loading">, string> = {
  safe: "\u2705",
  dangerous: "\uD83D\uDED1",
  suspicious: "\u26A0\uFE0F",
  unknown: "\u2753",
  disabled: "\u23F8\uFE0F",
};

export default function App() {
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<SecurityStatus>("loading");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [reasons, setReasons] = useState<string[]>([]);
  const [score, setScore] = useState<number>(0);
  const [stats, setStats] = useState<ExtensionStats>({ urlsChecked: 0, threatsBlocked: 0, trackersBlocked: 0 });
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<"dangerous" | "safe">("dangerous");
  const [reportDesc, setReportDesc] = useState("");
  const [reportResult, setReportResult] = useState<"success" | "duplicate" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [pageReasons, setPageReasons] = useState<string[]>([]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response: { stats: ExtensionStats } | null) => {
      if (response?.stats) setStats(response.stats);
    });
  }, []);

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
  }, [enabled]);

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

  const handleReport = () => {
    let domain: string;
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      return;
    }
    chrome.runtime.sendMessage(
      { type: "REPORT_SITE", domain, url, reportType, description: reportDesc },
      (response: { ok: boolean; reason?: string } | null) => {
        if (response?.ok) {
          setReportResult("success");
        } else {
          setReportResult("duplicate");
        }
        setTimeout(() => {
          setShowReport(false);
          setReportResult(null);
          setReportDesc("");
        }, 2000);
      },
    );
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
          <span style={{ fontSize: 20 }}>{"\uD83D\uDEE1\uFE0F"}</span>
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
          <span>{enabled ? "Aktif" : "Pasif"}</span>
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
              {status === "loading" ? "Kontrol ediliyor..." : config?.label}
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
              Tehlike skoru: {score}/100
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
        <StatItem label="Kontrol" value={stats.urlsChecked} />
        <StatItem label="Tehdit" value={stats.threatsBlocked} color="#dc2626" />
        <StatItem label="Tracker" value={stats.trackersBlocked} color="#d97706" />
      </div>

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
          {showHistory ? "Gecmisi gizle" : "Tarama gecmisi"}
        </button>
      </div>

      {showHistory && (
        <div style={{ maxHeight: 200, overflowY: "auto", borderTop: "1px solid #e5e7eb" }}>
          {history.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
              Henuz tarama yok
            </div>
          ) : (
            <>
              {history.map((entry, i) => (
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
                    {entry.level === "SAFE" ? "Guvenli" : entry.level === "DANGEROUS" ? "Tehlikeli" : entry.level === "SUSPICIOUS" ? "Suppheli" : "Bilinmiyor"}
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
                  Gecmisi temizle
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Report */}
      <div style={{ padding: "8px 16px", borderTop: "1px solid #e5e7eb" }}>
        {!showReport ? (
          <button
            onClick={() => setShowReport(true)}
            disabled={!url || status === "loading" || status === "disabled"}
            style={{
              width: "100%",
              padding: "7px 0",
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: "#6b7280",
              fontFamily: "inherit",
            }}
          >
            Bu siteyi raporla
          </button>
        ) : reportResult ? (
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              padding: "6px 0",
              color: reportResult === "success" ? "#166534" : "#d97706",
            }}
          >
            {reportResult === "success" ? "Rapor gonderildi!" : "Bu site zaten raporlanmis."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                <input type="radio" name="rt" checked={reportType === "dangerous"} onChange={() => setReportType("dangerous")} />
                Tehlikeli
              </label>
              <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                <input type="radio" name="rt" checked={reportType === "safe"} onChange={() => setReportType("safe")} />
                Guvenli
              </label>
            </div>
            <input
              type="text"
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="Aciklama (opsiyonel)"
              style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12, outline: "none" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleReport}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                Gonder
              </button>
              <button
                onClick={() => { setShowReport(false); setReportDesc(""); }}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#6b7280",
                  fontFamily: "inherit",
                }}
              >
                Iptal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          fontSize: 11,
          color: "#9ca3af",
          textAlign: "center",
          background: "#f9fafb",
        }}
      >
        Alparslan v0.1.0 — Dijital Savunma
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
