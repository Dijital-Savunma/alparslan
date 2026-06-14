import { type ReactNode } from "react";

/**
 * Genel amaçlı onaylama modali. Overlay + kart + başlık + gövde yapısını
 * paylaşır; her özel modal kendi butonlarını children olarak verir.
 *
 * Önce 3 yerde (DisableConfirm, CloseConfirm, TrustConfirm) inline
 * kopyalanmış 75 satırlık aynı overlay/kart kodu vardı; tek shell'e
 * indirgendi. Options.tsx içindeki iki inline modal da bu shell'e
 * taşındı (@mertinkos review).
 *
 * CSS var fallback'leri: popup'ta tema değişkenleri (--surface, --text)
 * tanımlı, options'ta tanımsız. Fallback olmadan options'ta arka plan
 * boş string'e düşüyordu; somut renklerle güvenceye alındı.
 *
 * Kullanım:
 *   <ConfirmModal title="..." body="...">
 *     <button onClick={...}>Onayla</button>
 *     <button onClick={...}>Vazgeç</button>
 *   </ConfirmModal>
 */
export function ConfirmModal({
  title,
  body,
  children,
}: {
  title: ReactNode;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface, white)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 14,
          padding: 18,
          maxWidth: 380,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text, #1e293b)", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", lineHeight: 1.5, marginBottom: 16 }}>
          {body}
        </div>
        {children}
      </div>
    </div>
  );
}
