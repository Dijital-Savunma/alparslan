import { useState, useEffect } from "react";
import type { DashboardData } from "@/dashboard/types";

const BREAKDOWN_LABELS: { key: keyof DashboardData["breakdown"]; label: string; max: number; color: string }[] = [
  { key: "httpsScore", label: "HTTPS", max: 30, color: "#22c55e" },
  { key: "threatAvoidanceScore", label: "Tehdit", max: 30, color: "#3b82f6" },
  { key: "activityScore", label: "Aktivite", max: 20, color: "#8b5cf6" },
  { key: "trackerScore", label: "Tracker", max: 20, color: "#f59e0b" },
];

function getScoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export default function DashboardTab() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "GET_DASHBOARD_SCORE" },
      (response: { dashboard: DashboardData } | null) => {
        if (response?.dashboard) {
          setDashboard(response.dashboard);
        }
      },
    );
  }, []);

  if (!dashboard) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
        Yukleniyor...
      </div>
    );
  }

  const scoreColor = getScoreColor(dashboard.score);

  return (
    <div style={{ padding: 16 }}>
      {/* Score Circle */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: "4px solid " + scoreColor,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{dashboard.score}</span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Haftalik Guvenlik Skoru</div>
      </div>

      {/* Breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {BREAKDOWN_LABELS.map(({ key, label, max, color }) => {
          const value = dashboard.breakdown[key];
          const pct = Math.round((value / max) * 100);
          return (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                <span>{label}</span>
                <span>{value}/{max}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <MiniStat label="Kontrol" value={dashboard.currentWeek.urlsChecked} />
        <MiniStat
          label="HTTPS"
          value={
            dashboard.currentWeek.httpsCount + dashboard.currentWeek.httpCount > 0
              ? Math.round((dashboard.currentWeek.httpsCount / (dashboard.currentWeek.httpsCount + dashboard.currentWeek.httpCount)) * 100) + "%"
              : "0%"
          }
        />
        <MiniStat label="Engellenen Tehdit" value={dashboard.currentWeek.threatsBlocked} />
        <MiniStat label="Engellenen Tracker" value={dashboard.currentWeek.trackersBlocked} />
      </div>

      {/* Tips */}
      {dashboard.tips.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Oneriler</div>
          {dashboard.tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 11, color: "#78350f", padding: "2px 0" }}>
              * {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div>
    </div>
  );
}
