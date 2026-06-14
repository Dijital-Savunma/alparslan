import { type ExtensionStats } from "@/utils/types";
import t from "@/i18n/tr";

/**
 * Bildirim çekmecesi / "🔔 hoş geldiniz" paneli.
 *
 * Popup header'ındaki 🔔 butonuna basıldığında açılan kapsamlı bilgi
 * paneli:
 *  - "Alparslan hoş geldiniz" linkiyle açılış
 *  - "X gündür korunuyorsunuz" rozeti
 *  - Bugünkü özet (kontrol / tehdit / takipçi / şüpheli sayıları)
 *  - "Bu sayfada ne var?" sözlük (renkli kategorilerle terim açıklaması)
 *
 * Stateless: tüm state üst component'tan (infoOpen, stats, vs.) gelir.
 */
export function NotificationPanel({
  infoOpen,
  setInfoOpen,
  stats,
  unknownCount,
  protectedDays,
}: {
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
  stats: ExtensionStats;
  unknownCount: number;
  protectedDays: number;
}) {
  const g = t.notificationCenter.glossary;
  return (
    <div
      style={{
        margin: "10px auto 0 auto",
        width: 300,
        padding: 12,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 8px 18px rgba(30, 64, 175, 0.08)",
        color: "var(--text)",
      }}
    >
      {/* Welcome message */}
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          color: "var(--text-muted)",
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px 10px",
          marginBottom: 10,
        }}
      >
        {t.notificationCenter.welcome}
        <span
          onClick={() => chrome.tabs.create({ url: "https://dijitalsavunma.org/" })}
          title={t.notificationCenter.welcomeLinkTitle}
          style={{ color: "var(--accent-info)", fontWeight: 800, cursor: "pointer" }}
        >
          {t.notificationCenter.welcomeLink}
        </span>
        {t.notificationCenter.welcomeSuffix}
      </div>

      {/* Protected days badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "#dbeafe",
            color: "var(--accent-info-deep)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          🛡️
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
          {t.notificationCenter.protectedDays(protectedDays)}
        </div>
      </div>

      {/* Daily summary */}
      <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-muted)", marginBottom: 10 }}>
        <div>
          {t.notificationCenter.todayPrefix}
          <strong style={{ color: "var(--accent-info-deep)" }}>{stats.urlsChecked}</strong>
          {t.notificationCenter.todayChecked}
        </div>
        <div>
          <strong style={{ color: stats.threatsBlocked > 0 ? "var(--accent-danger)" : "var(--accent-success)" }}>
            {stats.threatsBlocked}
          </strong>
          {t.notificationCenter.todayThreats}
        </div>
        <div>
          <strong style={{ color: stats.trackersBlocked > 0 ? "var(--accent-warning)" : "var(--accent-success)" }}>
            {stats.trackersBlocked}
          </strong>
          {t.notificationCenter.todayTrackers}
        </div>
        <div>
          <strong style={{ color: unknownCount > 0 ? "#3640a0" : "var(--accent-success)" }}>
            {unknownCount}
          </strong>
          {t.notificationCenter.todayUnknowns}
        </div>
      </div>

      <button
        onClick={() => setInfoOpen(!infoOpen)}
        style={{
          width: "70%",
          margin: "8px auto 10px auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          padding: "7px 10px",
          border: "1px solid #bfdbfe",
          background: "#eef2ff",
          color: "var(--accent-info)",
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {infoOpen ? (
          t.notificationCenter.infoButtonHide
        ) : (
          <>
            <span style={{ fontSize: 14 }}>📘</span>
            <span>{t.notificationCenter.infoButton}</span>
          </>
        )}
      </button>

      {infoOpen && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 11px",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text)", marginBottom: 6 }}>
            {t.notificationCenter.infoTitle}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent-info-bright)" }}>{g.controlLabel}: </strong>
            {g.controlDesc}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "#38bdf8" }}>{g.scoreLabel}: </strong>
            {g.scoreDesc1}
            <strong style={{ color: "var(--accent-success)" }}>{g.scoreRangeGood}</strong>
            {g.scoreDesc2}
            <strong style={{ color: "var(--accent-warning)" }}>{g.scoreRangeMedium}</strong>
            {g.scoreDesc3}
            <strong style={{ color: "var(--accent-danger)" }}>{g.scoreRangeBad}</strong>
            {g.scoreDesc4}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent-success)" }}>{g.whitelistLabel}: </strong>
            {g.whitelistDesc}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--text)" }}>{g.blacklistLabel}: </strong>
            {g.blacklistDesc}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent-danger)" }}>{g.threatLabel}: </strong>
            {g.threatDesc}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--accent-warning)" }}>{g.trackerLabel}: </strong>
            {g.trackerDesc}
          </div>
          <div>
            <strong style={{ color: "#818cf8" }}>{g.unknownLabel}: </strong>
            {g.unknownDesc}
          </div>
        </div>
      )}
    </div>
  );
}
