import { useState } from "react";

/**
 * Ayarlar sekmesindeki tek bir ayar kartı (Tehlike Uyarıları, Karanlık Mod,
 * Alparslan Asistan, vs.).
 *
 * A11y: native <button role="switch"> olarak render edilir — Tab ile
 * fokuslanır, Enter/Space ile aktive olur, screen reader doğru anlamsal
 * etiketleme yapar (aria-checked + aria-label).
 *
 * Mikro etkileşim: her toggle değişimi sonrası "Ayar kaydedildi" pulse'ı
 * (settingSavedPulse keyframes, theme.ts) 600ms oynatır.
 */
export function SettingCard({
  title,
  desc,
  enabled,
  onToggle,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const [justSaved, setJustSaved] = useState(false);
  const handleToggle = () => {
    onToggle();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 600);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${title}: ${enabled ? "ayar aktif" : "ayar kapali"}`}
      onClick={handleToggle}
      className={`alparslan-setting-card${justSaved ? " setting-card-saved" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        marginBottom: 10,
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        color: "var(--text)",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
      </div>
      <div
        title={enabled ? `${title}: ayar acik` : `${title}: ayar kapali`}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = enabled
            ? "0 0 0 4px rgba(34, 197, 94, 0.18), 0 3px 8px rgba(34, 197, 94, 0.25)"
            : "0 0 0 4px rgba(148, 163, 184, 0.20), 0 3px 8px rgba(15, 23, 42, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "none";
        }}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: enabled ? "var(--accent-success-bright)" : "#d1d5db",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s, transform 0.18s ease, box-shadow 0.18s ease",
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
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </button>
  );
}
