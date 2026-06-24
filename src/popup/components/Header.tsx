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
  unreadCount,
}: {
  enabled: boolean;
  onToggleEnabled: (newEnabled: boolean) => void;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  /** Toplam okunmamis bildirim sayisi — remote changelog'lardan. */
  unreadCount: number;
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
        onClick={() => chrome.tabs.create({ url: "https://alparslan.dijitalsavunma.org/" })}
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
          // flex:1 kaldirildi — hover alani logo+yazi genisliginde kalsin.
          // Bell ve toggle marginLeft: auto ile saga itilir.
          display: "flex",
          alignItems: "center",
          gap: 10,
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
          width={36}
          height={36}
          decoding="async"
          loading="eager"
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            transition: "all 0.15s ease",
            // SVG'yi keskin kalmasi icin — eski 36px boyutta antialias
            // yumusatmasi nedeniyle hafif bulanik gorunuyordu.
            imageRendering: "-webkit-optimize-contrast" as const,
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

      {/* Bildirim cekmecesi butonu — sadece 🔔 ikonu, halka/cerceve yok.
          Acik durumda zil sari/parlak vurgu alir (drop-shadow glow), kapali
          durumda sade gorunur. Tekrar basinca panel kapanir; X butonu da
          panelin sag ust kosesinde duruyor. */}
      <button
        onClick={onToggleNotifications}
        title={notificationsOpen ? t.notificationCenter.close : t.notificationCenter.open}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px) scale(1.10)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
        }}
        style={{
          marginLeft: "auto",
          width: 30,
          height: 30,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          transition: "transform 0.2s ease, filter 0.2s ease",
          filter: notificationsOpen
            ? "drop-shadow(0 0 6px rgba(253, 224, 71, 0.85))"
            : "none",
          position: "relative",
        }}
      >
        🔔
        {/* Kirmizi rozet — okunmamis bildirim sayisini gosterir. 0 ise
            hic render olmaz. 9'dan fazlaysa "9+" gosterir (kotu UX'i
            engelle: tek karakter kalsin). */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              borderRadius: 999,
              background: "#dc2626",
              color: "white",
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "system-ui, -apple-system, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--accent-navy)",
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
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
