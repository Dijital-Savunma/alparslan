import t from "@/i18n/tr";

/**
 * Popup en altta yer alan sade versiyon etiketi. Stateless. Surum
 * numarasini manifest.json'dan okur — i18n sadece "Alparslan v{x.y.z}"
 * formatini tutuyor, somut string yok.
 */
export function Footer() {
  const version = chrome.runtime.getManifest().version;
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
        <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>{t.footer(version)}</div>
      </div>
    </div>
  );
}
