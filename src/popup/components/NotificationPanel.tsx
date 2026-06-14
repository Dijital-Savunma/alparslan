import t from "@/i18n/tr";

/**
 * Bildirim çekmecesi / "🔔 hoş geldiniz" paneli.
 *
 * Popup header'ındaki 🔔 butonuna basıldığında açılan kapsamlı bilgi
 * paneli:
 *  - "Alparslan hoş geldiniz" linkiyle açılış
 *  - "X gündür korunuyorsunuz" rozeti
 *  - Kümülatif özet (kontrol / tehdit / potansiyel risk sayıları)
 *  - "Bu sayfada ne var?" sözlük (renkli kategorilerle terim açıklaması)
 *
 * Stateless: tüm state üst component'tan (infoOpen, stats, vs.) gelir.
 *
 * controlCount, threatCount ve unknownCount Skor/Durum paneliyle ayni
 * history kaynagindan beslenir — boylece her yerde sayilar tutarli kalir.
 * Eskiden "kontrol" sayisi stats.urlsChecked (session counter) idi, Chrome
 * restart'inda sifirlandigi icin Durum card'iyla uyusmuyordu.
 */
export function NotificationPanel({
  infoOpen,
  setInfoOpen,
  controlCount,
  threatCount,
  unknownCount,
  protectedDays,
}: {
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
  controlCount: number;
  threatCount: number;
  unknownCount: number;
  protectedDays: number;
}) {
  const g = t.notificationCenter.glossary;
  return (
    <div
      style={{
        margin: "18px auto",
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
          color: "var(--text)",
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.color = "var(--accent-info-deep)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.color = "var(--accent-info)";
          }}
          title={t.notificationCenter.welcomeLinkTitle}
          style={{
            color: "var(--accent-info)",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-block",
            transformOrigin: "left center",
            transition: "color 0.15s ease, transform 0.15s ease",
          }}
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

      {/* Cumulative summary — Skor / Durum panelleriyle ayni veriden besleniyor:
          control = history.length, tehdit = DANGEROUS|SUSPICIOUS, risk = UNKNOWN. */}
      <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text)", marginBottom: 10 }}>
        <div>
          {t.notificationCenter.todayPrefix}
          <strong style={{ color: "var(--accent-info-deep)" }}>{controlCount}</strong>
          {t.notificationCenter.todayChecked}
        </div>
        <div>
          <strong style={{ color: threatCount > 0 ? "var(--accent-danger)" : "var(--accent-success)" }}>
            {threatCount}
          </strong>
          {t.notificationCenter.todayThreats}
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#dbeafe";
          e.currentTarget.style.borderColor = "#93c5fd";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#eef2ff";
          e.currentTarget.style.borderColor = "#bfdbfe";
          e.currentTarget.style.transform = "translateY(0)";
        }}
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
          transition: "background 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
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
            color: "var(--text)",
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
          <div>
            <strong style={{ color: "#818cf8" }}>{g.unknownLabel}: </strong>
            {g.unknownDesc}
          </div>
        </div>
      )}
    </div>
  );
}
