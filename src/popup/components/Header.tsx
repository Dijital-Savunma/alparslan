/**
 * Popup üst çubuğu: Alparslan logosu + "Alparslan" yazısı (her ikisi
 * dijitalsavunma.org'a yönlendiren tek bir buton) + Ayarlar (gear).
 * "Aktif/Pasif" toggle Genel Ayarlar sayfasina tasindi.
 */
export function Header() {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--accent-navy), var(--accent-navy-deep))",
        borderBottom: "1px solid rgba(148, 163, 184, 0.20)",
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

      {/* Ayarlar butonu — Tum Ayarlar (options.html) sayfasini yeni
          sekmede acar. Header'in sag ust kosesinde sade SVG sliders. */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        title="Tüm Ayarlar"
        aria-label="Tüm Ayarlar"
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          transition: "transform 0.25s ease",
          color: "#f8fafc",
        }}
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="10" y2="6" />
          <line x1="14" y1="6" x2="20" y2="6" />
          <circle cx="12" cy="6" r="2" />

          <line x1="4" y1="12" x2="14" y2="12" />
          <line x1="18" y1="12" x2="20" y2="12" />
          <circle cx="16" cy="12" r="2" />

          <line x1="4" y1="18" x2="6" y2="18" />
          <line x1="10" y1="18" x2="20" y2="18" />
          <circle cx="8" cy="18" r="2" />
        </svg>
      </button>

    </div>
  );
}
