import t from "@/i18n/tr";

/**
 * Popup üst çubuğu: Alparslan logosu + "Alparslan" yazısı (her ikisi
 * dijitalsavunma.org'a yönlendiren tek bir buton) + bildirim çekmecesi
 * butonu (🔔) + "Aktif/Pasif" toggle.
 *
 * A11y: Marka buton'u native <button> (Tab + Enter); toggle native
 * <button role="switch" aria-checked> ile klavye ve screen reader
 * uyumlu.
 *
 * Stateless: tüm interaktif durumlar üst component'tan (App.tsx)
 * prop olarak gelir.
 */
export function Header({
  enabled,
  onToggleEnabled,
  notificationsOpen,
  onToggleNotifications,
}: {
  enabled: boolean;
  onToggleEnabled: (newEnabled: boolean) => void;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--accent-navy), var(--accent-navy-deep))",
        borderBottom: "2px solid var(--accent-info-bright)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        color: "#f8fafc",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Marka (logo + isim) — tek native button olarak sarıldı (klavye
          erişimi + screen reader düzgün etiketleme için). Hover'da logo
          büyür/parlar, yazı maviye döner. */}
      <button
        type="button"
        onClick={() => chrome.tabs.create({ url: "https://dijitalsavunma.org/" })}
        title="Dijital Savunma sitesine git"
        aria-label="Dijital Savunma sitesine git"
        onMouseEnter={(e) => {
          const img = e.currentTarget.querySelector("img");
          const span = e.currentTarget.querySelector("span");
          if (img) {
            img.style.transform = "translateY(-1px) scale(1.07)";
            img.style.filter = "drop-shadow(0 0 8px rgba(96, 165, 250, 0.75))";
          }
          if (span) {
            span.style.color = "#60a5fa";
            span.style.textShadow = "0 0 8px rgba(96, 165, 250, 0.65)";
            span.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          const img = e.currentTarget.querySelector("img");
          const span = e.currentTarget.querySelector("span");
          if (img) {
            img.style.transform = "translateY(0) scale(1)";
            img.style.filter = "none";
          }
          if (span) {
            span.style.color = "#f8fafc";
            span.style.textShadow = "none";
            span.style.transform = "translateY(0)";
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <img
          src="/icons/alparslan_logo.svg"
          alt=""
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            transition: "all 0.15s ease",
          }}
        />
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: 0.3,
            color: "#f8fafc",
            transition: "all 0.15s ease",
            display: "inline-block",
          }}
        >
          Alparslan
        </span>
      </button>

      {/* Bildirim çekmecesi butonu — açıkken ✕, kapalıyken 🔔 */}
      <button
        onClick={onToggleNotifications}
        title={notificationsOpen ? t.notificationCenter.close : t.notificationCenter.open}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = notificationsOpen
            ? "rgba(248, 250, 252, 0.22)"
            : "rgba(96, 165, 250, 0.18)";
          e.currentTarget.style.transform = "translateY(-1px) scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = notificationsOpen
            ? "rgba(248, 250, 252, 0.12)"
            : "rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.transform = "translateY(0) scale(1)";
        }}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: notificationsOpen
            ? "1px solid rgba(248, 250, 252, 0.55)"
            : "1px solid rgba(191, 219, 254, 0.35)",
          background: notificationsOpen ? "rgba(248, 250, 252, 0.12)" : "rgba(255, 255, 255, 0.08)",
          color: notificationsOpen ? "#e2e8f0" : "#bfdbfe",
          cursor: "pointer",
          fontSize: notificationsOpen ? 18 : 14,
          fontWeight: notificationsOpen ? 500 : 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          transition: "all 0.2s ease",
          boxShadow: notificationsOpen ? "0 0 10px rgba(148, 163, 184, 0.35)" : "none",
        }}
      >
        {notificationsOpen ? "✕" : "🔔"}
      </button>

      {/* "Aktif/Pasif" toggle — yeşil glow on, gray off */}
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
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? t.protectionToggle.disable : t.protectionToggle.enable}
          onClick={() => onToggleEnabled(!enabled)}
          title={enabled ? t.protectionToggle.disable : t.protectionToggle.enable}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px) scale(1.05)";
            e.currentTarget.style.boxShadow = enabled
              ? "0 0 0 3px rgba(34, 197, 94, 0.25), 0 3px 8px rgba(34, 197, 94, 0.35)"
              : "0 0 0 3px rgba(255, 255, 255, 0.12), 0 3px 8px rgba(0, 0, 0, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "none";
          }}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: enabled ? "var(--accent-success-bright)" : "#4b5563",
            position: "relative",
            transition: "background 0.2s, transform 0.18s ease, box-shadow 0.18s ease",
            cursor: "pointer",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
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
        </button>
      </label>
    </div>
  );
}
