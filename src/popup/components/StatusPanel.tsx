import React from "react";
import { type ExtensionSettings } from "@/utils/types";
import t from "@/i18n/tr";
import { narrateReason } from "../narrateReason";
import { type SecurityStatus } from "../App";

/**
 * Popup Durum sekmesindeki ana status panosu. Iki sunum modu var:
 *
 *  1. Asistan modu (settings.speechBubbleEnabled !== false) — Alparslan
 *     logosu solda + saga dogru renkli konusma balonu icinde verdict
 *     metni + (gerekirse) "Sayfadan Ayril / Bu Adrese Guven" aksiyon
 *     butonlari. Balon icinde teknik reason'lar Alparslan'in agzindan
 *     dogal cumlelere donusur (narrateReason).
 *
 *  2. Klasik mod — kompakt "● durum dotu + label + domain + hizli
 *     whitelist butonu" satiri. Loading / disabled durumlarinda da bu
 *     mod kullanilir (verdict olmadigi icin balonu anlamsiz).
 *
 * Stateless: gosterimi etkileyen tum veri ust component'tan (App.tsx) prop
 * olarak alinir. Onaylama modalleri (sayfayi kapat / siteye guven) parent
 * tarafindan state set edilir, burada sadece setter cagirilir.
 */
export function StatusPanel({
  config,
  displayStatus,
  displayDomain,
  settings,
  reasons,
  pageReasons,
  isWhitelisted,
  popupWhitelistInput,
  setPopupWhitelistInput,
  handleAddToWhitelist,
  setShowCloseConfirm,
  setShowTrustConfirm,
  enabled,
}: {
  config: { label: string; color: string; bg: string } | null;
  displayStatus: SecurityStatus;
  displayDomain: string;
  settings: ExtensionSettings | null;
  reasons: string[];
  pageReasons: string[];
  isWhitelisted: boolean;
  /** Whitelist input degeri — su an JSX'te kullanilmıyor ama parent App'ten
   *  geliyor, ileride autofill chip burada kullanilirsa diye prop'ta tutuldu. */
  popupWhitelistInput: string;
  setPopupWhitelistInput: (v: string) => void;
  handleAddToWhitelist: () => void;
  setShowCloseConfirm: (v: boolean) => void;
  setShowTrustConfirm: (v: boolean) => void;
  enabled: boolean;
}) {
  // Linter unused-prop uyarisini bastir — ileride autofill chip eklenirse
  // doğrudan kullanılacaklar.
  void popupWhitelistInput;
  void setPopupWhitelistInput;
  return (
      <div
        style={{
          padding: "12px 16px",
          background: config?.bg || "rgba(107, 114, 128, 0.05)",
          borderBottom: `3px solid ${config?.color || "#e5e7eb"}`,
          // Soft inner top-edge glow in the status colour so the panel reads
          // as a tinted surface on both light and dark themes without
          // needing a heavy fill.
          boxShadow: config ? `inset 0 1px 0 ${config.color}40` : "none",
          position: "relative",
        }}
      >
        {/* One-time bright-grey light ray sweeping across this status box every
            time the popup opens — top-left corner → bottom-right corner,
            widening mid-travel. Runs for every verdict (safe / suspicious /
            dangerous / unknown). pointer-events:none so clicks pass through. */}
        <div className="status-sweep-overlay"><div className="status-sweep-beam" /></div>
        {/* TWO PRESENTATIONS — driven by the "Konuşma Balonu ile Anlatım"
            setting. ON: a hero "logo on the left + speech bubble on the right
            with the URL pinned to the bubble's bottom strip" layout. OFF: the
            classic compact "● status dot + label + domain + whitelist button"
            row that was here before. Loading/disabled states always fall back
            to the classic row since there's no verdict to narrate. */}
        {settings?.speechBubbleEnabled !== false && displayStatus !== "loading" && displayStatus !== "disabled" ? (() => {
          const variant =
            displayStatus === "safe" ? "success" :
            displayStatus === "dangerous" ? "danger" :
            displayStatus === "suspicious" ? "warning" :
            "info";
          // Domain shown inside the sentence ("chatgpt.com sayfasını sizin
          // için..."); falls back to a generic noun when we don't have one.
          const siteName = displayDomain && displayDomain !== "—" ? displayDomain : "Bu sayfa";
          // A SAFE verdict on a site the user themselves trusts — greet them
          // accordingly instead of claiming we scanned it. Keys off the
          // authoritative isWhitelisted prop from App so it stays in sync with
          // the no-banner whitelist path.
          const whitelisted = displayStatus === "safe" && isWhitelisted;
          const message =
            whitelisted ? t.speechBubble.whitelisted(siteName) :
            displayStatus === "safe" ? t.speechBubble.safe(siteName) :
            displayStatus === "dangerous" ? t.speechBubble.dangerous(siteName) :
            displayStatus === "suspicious" ? t.speechBubble.suspicious(siteName) :
            t.speechBubble.unknown(siteName);
          // Leading status emoji renders OUTSIDE the text flow so wrapped
          // lines start where "the words" start, not next to the bubble's
          // left edge.
          const leadEmoji =
            displayStatus === "safe" ? "🛡️" :
            displayStatus === "dangerous" ? "🚨" :
            displayStatus === "suspicious" ? "⚠️" :
            "🔍";
          // Word that gets bolded + status-coloured so the eye lands on the
          // verdict in one glance without making the whole bubble loud.
          const highlightWord =
            whitelisted ? "iyi gezintiler" :
            displayStatus === "safe" ? "güvendesiniz" :
            displayStatus === "dangerous" ? "uzaklaşın" :
            displayStatus === "suspicious" ? "dikkatli olun" :
            "merak etmeyin";
          const accentColor =
            displayStatus === "safe" ? "#16a34a" :
            displayStatus === "dangerous" ? "#dc2626" :
            displayStatus === "suspicious" ? "#d97706" :
            "#2563eb";
          // Build the body with two callouts: the domain (semi-bold accent)
          // and the verdict keyword (bold accent). Both lean on accentColor;
          // weight separates them.
          const dIdx = message.indexOf(siteName);
          const renderBody = (): React.ReactNode => {
            if (dIdx === -1) {
              const hIdx = message.indexOf(highlightWord);
              if (hIdx === -1) return message;
              return (
                <>
                  {message.slice(0, hIdx)}
                  <strong style={{ color: accentColor, fontWeight: 700, whiteSpace: "nowrap" }}>{message.slice(hIdx, hIdx + highlightWord.length)}</strong>
                  {message.slice(hIdx + highlightWord.length)}
                </>
              );
            }
            const beforeDomain = message.slice(0, dIdx);
            const afterDomain = message.slice(dIdx + siteName.length);
            const hIdxAfter = afterDomain.indexOf(highlightWord);
            if (hIdxAfter === -1) {
              return (
                <>
                  {beforeDomain}
                  <span style={{ color: accentColor, fontWeight: 600, whiteSpace: "nowrap" }}>{siteName}</span>
                  {afterDomain}
                </>
              );
            }
            return (
              <>
                {beforeDomain}
                <span style={{ color: accentColor, fontWeight: 600, whiteSpace: "nowrap" }}>{siteName}</span>
                {afterDomain.slice(0, hIdxAfter)}
                <strong style={{ color: accentColor, fontWeight: 700, whiteSpace: "nowrap" }}>{afterDomain.slice(hIdxAfter, hIdxAfter + highlightWord.length)}</strong>
                {afterDomain.slice(hIdxAfter + highlightWord.length)}
              </>
            );
          };
          const messageNode = renderBody();
          return (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 4 }}>
                {/* Big logo with soft outer glow in the verdict colour — sits
                    flush against the bubble so the speech tail appears to
                    emerge straight from its edge. Hover lifts + tilts the
                    helmet slightly to feel alive. */}
                <div
                  className={`alparslan-bubble-logo alparslan-mood-${displayStatus}`}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "var(--surface-card)",
                    border: `2px solid var(--btn-${variant}-border)`,
                    boxShadow: `0 0 0 4px var(--btn-${variant}-bg), 0 2px 10px var(--btn-${variant}-border)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    marginTop: -2,
                    cursor: "pointer",
                  }}
                >
                  <img
                    src="/icons/alparslan_logo.svg"
                    alt="Alparslan"
                    style={{ width: "78%", height: "78%" }}
                  />
                </div>

                {/* Bubble — soft tinted surface in the verdict colour, dark
                    body text for readability, with a small tail pointing
                    left into the logo. URL pinned to a separated bottom
                    strip with a globe icon. */}
                <div style={{
                  position: "relative",
                  flex: 1,
                  minWidth: 0,
                  background: `var(--btn-${variant}-bg)`,
                  border: `1px solid var(--btn-${variant}-border)`,
                  borderRadius: 12,
                  color: "var(--text)",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  marginLeft: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4, padding: "8px 11px 7px", fontSize: 12.5, lineHeight: 1.45 }}>
                    {/* Leading verdict emoji as its own flex item so wrapped
                        lines of the body align with the body's left edge
                        instead of the bubble's. */}
                    <span style={{ flexShrink: 0, lineHeight: 1.45 }}>{leadEmoji}</span>
                    <div style={{ flex: 1, minWidth: 0, hyphens: "auto" }}>
                      {messageNode}
                      {/* Balonun ICINDE: "dikkatli olun!" cumlesinin hemen
                          altinda Alparslan agziyla anlatilan reasonlar.
                          Eski "altta cikan • bullet listesi" tamamen burada,
                          balonun icine tasindi — kullanici sebepleri
                          Alparslan'in konusmasinin devami gibi okur.

                          SAFE durumda HIC reason gostermiyoruz: Alparslan
                          "her sey sapasaglam, guvendesiniz" diyorken altta
                          "kredi karti soruyor, dikkat" bullet'i celiski
                          yaratir. Trusted domain'lerde (github.com gibi)
                          DOM analizinin bildirdigi sinyaller bilgilendirici
                          olarak duser ama kullaniciya gosterilmez. */}
                      {displayStatus !== "safe" && (reasons.length > 0 || pageReasons.length > 0) && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {[...reasons, ...pageReasons].map((r, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: 11.5,
                                lineHeight: 1.4,
                                color: "var(--text)",
                                opacity: 0.92,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 5,
                              }}
                            >
                              <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>•</span>
                              <span>{narrateReason(r)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action row — only when the verdict actually carries risk.
                      Hero "Sayfayı Kapat" mirrors the verdict colour so users
                      hit the safe move instinctively; the secondary "Bu Adrese
                      Güven" stays transparent + bordered so it can't be tapped
                      reflexively. */}
                  {displayStatus !== "safe" && (
                    <>
                      <div style={{
                        padding: "0 10px 6px",
                        fontSize: 11.5,
                        lineHeight: 1.45,
                        color: "var(--text)",
                      }}>
                        {(() => {
                          // "Dilerseniz" rendered slightly darker + bolder so
                          // the eye lands on the consent cue first — emphasises
                          // that this is an OPT-IN moment, not a directive.
                          const txt = t.speechBubble.actionPrompt;
                          const word = "Dilerseniz";
                          const idx = txt.indexOf(word);
                          if (idx === -1) return txt;
                          return (
                            <>
                              <strong style={{ color: "var(--text-strong)", fontWeight: 700 }}>{word}</strong>
                              {txt.slice(idx + word.length)}
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ display: "flex", gap: 6, padding: "0 8px 8px" }}>
                        <button
                          onClick={() => setShowCloseConfirm(true)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#1d4ed8";
                            e.currentTarget.style.transform = "scale(1.04)";
                            e.currentTarget.style.boxShadow = "0 3px 8px rgba(37, 99, 235, 0.40)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#2563eb";
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.10)";
                          }}
                          style={{
                            flex: 1,
                            // Always corporate blue, regardless of verdict colour. The bubble
                            // already carries the warning hue; the button is a calm CTA that
                            // shouldn't panic the user when the site isn't confirmed-malicious.
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            padding: "3px 5px",
                            borderRadius: 5,
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 3,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.10)",
                            lineHeight: 1.2,
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          {t.speechBubble.actionClose}
                        </button>
                        {!isWhitelisted && (
                          <button
                            onClick={() => setShowTrustConfirm(true)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.04)";
                              e.currentTarget.style.color = "var(--text)";
                              e.currentTarget.style.borderColor = "var(--text-muted)";
                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.color = "var(--text-muted)";
                              e.currentTarget.style.borderColor = "var(--border-strong)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                            style={{
                              flex: 1,
                              background: "var(--surface-card)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border-strong)",
                              padding: "3px 5px",
                              borderRadius: 5,
                              fontSize: 9,
                              fontWeight: 500,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              transition: "all 0.15s ease",
                              lineHeight: 1.2,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.speechBubble.actionTrust}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {/* Tail (rotated square overlapping the bubble's left edge
                      so its tip is flush with the logo). */}
                  <div style={{
                    position: "absolute",
                    left: -5,
                    top: 14,
                    transform: "rotate(45deg)",
                    width: 9,
                    height: 9,
                    background: `var(--btn-${variant}-bg)`,
                    borderLeft: `1px solid var(--btn-${variant}-border)`,
                    borderBottom: `1px solid var(--btn-${variant}-border)`,
                  }} />
                </div>
              </div>

            </>
          );
        })() : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <span
              style={{
                animation: displayStatus === "safe" && enabled ? "safePulse 1.6s ease-out infinite" : "none",
                boxShadow: displayStatus === "safe" && enabled ? "0 0 0 0 rgba(22, 163, 74, 0.45)" : "none",
                width: 10,
                height: 10,
                borderRadius: "50%",
                display: "inline-block",
                background:
                  displayStatus === "safe" ? "#16a34a" :
                  displayStatus === "dangerous" ? "#dc2626" :
                  displayStatus === "suspicious" ? "#d97706" : "#6b7280",
                marginTop: -15,
                flexShrink: 0,
              }}
            />
            <div
              title={
                displayStatus === "loading" ? undefined :
                displayStatus === "safe" ? t.statusMessages.safe :
                displayStatus === "dangerous" ? t.statusMessages.dangerous :
                displayStatus === "suspicious" ? t.statusMessages.suspicious :
                displayStatus === "disabled" ? t.statusMessages.disabled :
                t.statusMessages.unknown
              }
              style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, color: config?.color || "#374151" }}>
                {displayStatus === "loading" ? t.status.checking : config?.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{displayDomain}</div>
            </div>
          </div>

          {/* Classic right-side: inline quick-whitelist for non-safe verdicts. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {/* Inline quick-add button \u2014 only shows on non-safe verdicts
                and disappears once the site is whitelisted. */}
            {displayStatus !== "loading" && !isWhitelisted && displayDomain && displayDomain !== "\u2014" &&
              (displayStatus === "dangerous" || displayStatus === "suspicious" || displayStatus === "unknown") && (
              <button
                onClick={handleAddToWhitelist}
                title={t.popupWhitelist.tooltipAdd}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dbeafe";
                  e.currentTarget.style.borderColor = "#60a5fa";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#eff6ff";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#2563eb",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "5px 9px",
                  borderRadius: 10,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                {t.popupWhitelist.addButton}
              </button>
            )}
          </div>
        </div>
        )}

        {/* Eski "\u2022 reason" listesi balonun ICINE tasindi (yukaridaki
            narrated bullets). Burada artik render etmiyoruz. */}
      </div>
  );
}
