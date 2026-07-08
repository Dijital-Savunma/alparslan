import { useLoadingDots } from "./StatusPanel";

/**
 * Sekme icerigi (settings/dashboard) hazir degilken merkezi yukleniyor
 * goruntusu. Amac: popup'in cokerek kuculmesini engellemek — minHeight
 * tipik sekme icerigi yuksekliginde tutulur, kullanici "ekran donmus mu"
 * sanmaz.
 *
 * Goruntu: yesil donen halka + "{label} yukleniyor" + sabit-genislik
 * canli noktalar (. .. ...). Halka rengi `--accent-info` ile uyumlu;
 * popup'in mavi disiplini bozulmaz.
 */
export function TabLoadingPlaceholder({ label }: { label: string }) {
  const dots = useLoadingDots(true);
  return (
    <div
      style={{
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "24px 16px",
        color: "var(--text)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "3px solid rgba(59, 130, 246, 0.18)",
          borderTopColor: "var(--accent-info)",
          animation: "tabSpinner 0.9s linear infinite",
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
        {label} yükleniyor
        <span
          style={{
            display: "inline-block",
            width: 18,
            textAlign: "left",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {dots}
        </span>
      </div>
    </div>
  );
}
