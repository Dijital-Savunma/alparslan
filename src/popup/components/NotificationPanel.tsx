import React, { useState } from "react";
import t from "@/i18n/tr";
import type { DynamicNotification } from "@/notifications/dynamic-notifications";

/**
 * Bildirim cekmecesi — Header'daki 🔔 butonuna basildiginda acilir.
 *
 * Icerik:
 *  - Karsilama metni (link: alparslan.dijitalsavunma.org)
 *  - "X gundur korunuyorsunuz" rozeti
 *  - Bilgilendirme Merkezi (sozluk acilabilir)
 *  - Aktif uzaktan changelog karti (varsa)
 *
 * Kullanici aksiyonlari (Sayfadan Ayril, Bu Adrese Guven, ayar
 * toggle'lari) buraya bildirim olarak DUSMEZ — sadece release
 * changelog'lari gozukur.
 */

export function NotificationPanel({
  onClose,
  notification,
  onDismissNotification,
  onSoftCloseNotification,
  protectedDays,
}: {
  onClose: () => void;
  notification: DynamicNotification | null;
  onDismissNotification: () => void;
  onSoftCloseNotification: () => void;
  protectedDays: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const g = t.notificationCenter.glossary;
  return (
    <div
      style={{
        margin: "18px auto",
        width: 320,
        padding: 14,
        background: "var(--surface-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 8px 18px rgba(30, 64, 175, 0.08)",
        color: "var(--text)",
        position: "relative",
      }}
    >
      <button
        onClick={onClose}
        title={t.notificationCenter.close}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--accent-danger)";
          e.currentTarget.style.color = "white";
          e.currentTarget.style.borderColor = "var(--accent-danger)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--surface-card)";
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 20,
          height: 20,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--surface-card)",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s ease",
          lineHeight: 1,
          padding: 0,
          zIndex: 2,
        }}
      >
        ✕
      </button>

      {/* Sayfa basligi — orta hizali */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "var(--text)",
          letterSpacing: 0.3,
          marginTop: 4,
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Bildirimler
      </div>

      {/* Karsilama karti — uc parca (gurur rozeti + tanıtım metni +
          Bilgilendirme Merkezi butonu) tek bir kartta gruplandi.
          Onceden hepsi havada ucusuyordu. */}
      <div
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px 12px 10px",
          marginBottom: 12,
        }}
      >
        {/* En tepe — koruma sureci gurur rozeti, modern inline SVG tik
            ikonu ile. Emoji yerine custom SVG: yumusak yesil dolgulu
            daire icinde kalin yuvarlatilmis tik — guven veren ve sade. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "var(--accent-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 5px rgba(34, 197, 94, 0.28)",
            }}
            aria-hidden="true"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="5 12.5 10 17.5 19 7.5" />
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", lineHeight: 1.2 }}>
            {t.notificationCenter.protectedDays(protectedDays)}
          </div>
        </div>

        {/* Tanıtım metni — sade, link yok. Aksiyon alttaki butonda. */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          {t.notificationCenter.welcome}
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
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            padding: "8px 10px",
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
      </div>

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
          {(() => {
            const items: { key: string; node: React.ReactNode }[] = [
              {
                key: "control",
                node: (
                  <>
                    <strong style={{ color: "var(--accent-info-bright)" }}>{g.controlLabel}: </strong>
                    {g.controlDesc}
                  </>
                ),
              },
              {
                key: "threat",
                node: (
                  <>
                    <strong style={{ color: "var(--accent-danger)" }}>{g.threatLabel}: </strong>
                    {g.threatDesc}
                  </>
                ),
              },
              {
                key: "unknown",
                node: (
                  <>
                    <strong style={{ color: "#818cf8" }}>{g.unknownLabel}: </strong>
                    {g.unknownDesc}
                  </>
                ),
              },
              {
                key: "whitelist",
                node: (
                  <>
                    <strong style={{ color: "var(--accent-success)" }}>{g.whitelistLabel}: </strong>
                    {g.whitelistDesc}
                  </>
                ),
              },
              {
                key: "score",
                node: (
                  <>
                    <strong style={{ color: "#38bdf8" }}>{g.scoreLabel}: </strong>
                    {g.scoreDesc1}
                    <strong style={{ color: "var(--accent-success)" }}>{g.scoreRangeGood}</strong>
                    {g.scoreDesc2}
                    <strong style={{ color: "var(--accent-warning)" }}>{g.scoreRangeMedium}</strong>
                    {g.scoreDesc3}
                    <strong style={{ color: "var(--accent-danger)" }}>{g.scoreRangeBad}</strong>
                    {g.scoreDesc4}
                  </>
                ),
              },
            ];
            return (
              <>
                <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text)", marginBottom: 6 }}>
                  {t.notificationCenter.infoTitle}
                </div>
                {items.map((item, i) => (
                  <div key={item.key}>
                    {i > 0 && (
                      <div
                        style={{
                          height: 1,
                          background: "var(--border)",
                          opacity: 0.45,
                          margin: "6px 0",
                        }}
                      />
                    )}
                    <div>{item.node}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* Aktif uzaktan changelog karti — sadece okunmamis update varsa render */}
      {notification && (
        <>
          <div
            style={{
              height: 1,
              background: "var(--border)",
              opacity: 0.45,
              margin: "16px 0 12px",
            }}
          />
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--text)",
              background: "var(--surface-card)",
              border: "1px solid var(--accent-info-bright)",
              borderRadius: 10,
              padding: "10px 12px",
              boxShadow: "0 0 0 2px rgba(96, 165, 250, 0.12)",
              position: "relative",
            }}
          >
            <button
              onClick={onSoftCloseNotification}
              title="Bildirimi kapat"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-danger)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.borderColor = "var(--accent-danger)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 9,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingRight: 22 }}>
              <span style={{ fontSize: 16 }}>🎉</span>
              <strong style={{ color: "var(--accent-info-deep)", fontSize: 13 }}>
                {notification.title}
              </strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {notification.lines.map((line, i) => (
                <li key={i} style={{ color: "var(--text)" }}>{line}</li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                onClick={onDismissNotification}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-info-deep)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent-info)";
                }}
                style={{
                  background: "var(--accent-info)",
                  border: "none",
                  borderRadius: 5,
                  color: "white",
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                Bir daha gösterme
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
