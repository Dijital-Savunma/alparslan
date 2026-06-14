import t from "@/i18n/tr";

/**
 * Popup en altta yer alan sade versiyon etiketi. Stateless, sadece i18n
 * üzerinden t.footer string'ini ortalanmış halde gösterir.
 */
export function Footer() {
  return (
    <div
      style={{
        padding: "6px 16px",
        fontSize: 10,
        color: "var(--text-faint)",
        background: "var(--surface-elevated)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 10,
          color: "var(--text-faint)",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>{t.footer}</div>
      </div>
    </div>
  );
}
