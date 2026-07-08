import React, { useEffect, useRef, useState } from "react";
import { type ExtensionSettings } from "@/utils/types";
import t from "@/i18n/tr";
import { narrateReason } from "../narrateReason";
import { type SecurityStatus } from "../App";

/**
 * "Kontrol ediliyor" satirinda animasyonlu nokta sayisi (0→1→2→3→0...)
 * dondurur. Sadece displayStatus === "loading" iken interval kurulur, baska
 * durumda hemen "" kalır. Boylece kullanici "ekran dondu mu" diye dusunmez.
 */
export function useLoadingDots(active: boolean): string {
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!active) {
      setDots("");
      return;
    }
    const id = window.setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => window.clearInterval(id);
  }, [active]);
  return dots;
}

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
  setShowCloseConfirm: (v: boolean) => void;
  setShowTrustConfirm: (v: boolean) => void;
  enabled: boolean;
}) {
  // Linter unused-prop uyarisini bastir — ileride autofill chip eklenirse
  // doğrudan kullanılacaklar.
  void popupWhitelistInput;
  void setPopupWhitelistInput;
  // Loading durumunda "Kontrol ediliyor" yazisina animasyonlu nokta katarak
  // arayuzun donmadigini gostermek icin (sadece loading'de aktif).
  const loadingDots = useLoadingDots(displayStatus === "loading");
  return (
      <div
        style={{
          padding: "18px 6px",
          background: config?.bg || "rgba(107, 114, 128, 0.05)",
          borderBottom: `2px solid ${config?.color ? config.color + "88" : "rgba(148, 163, 184, 0.55)"}`,
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
          // Bilinmeyen (unknown) speech bubble icin gri palet: buton
          // ile ayni kimlik degil (buton mavi info, bubble gri neutral).
          // "Bilinmiyor" durumu icin gri ton daha isabetli.
          const variant =
            displayStatus === "safe" ? "success" :
            displayStatus === "dangerous" ? "danger" :
            displayStatus === "suspicious" ? "warning" :
            "neutral";
          // Domain shown inside the sentence ("chatgpt.com sayfasını sizin
          // için..."); falls back to a generic noun when we don't have one.
          const isGenericSite = !displayDomain || displayDomain === "—";
          // Generic durumda siteName ("Bu sayfayı") mesajin baslangicindaki
          // ekli hali — highlight logic dIdx bunu bulur ve tumunu strong'a
          // sarar: **Bu sayfayı** ilk defa gorüyorum...
          const siteName = isGenericSite ? "Bu sayfayı" : displayDomain;
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
            isGenericSite ? t.speechBubble.unknownGeneric :
            t.speechBubble.unknown(siteName);
          // Word that gets bolded + status-coloured so the eye lands on the
          // verdict in one glance without making the whole bubble loud.
          const highlightWord =
            whitelisted ? "iyi gezintiler" :
            displayStatus === "safe" ? "temiz görünüyor" :
            displayStatus === "dangerous" ? "hemen kapatın" :
            displayStatus === "suspicious" ? "dikkatli olun" :
            "tedbirli olun";
          // Vurgu rengi (domain adi + verdict keyword). CSS var kullanarak
          // karanlik modda otomatik acik tona kayar (btn-*-text light = koyu,
          // dark = parlak). Boylece "extensions" / "tedbirli olun" gibi
          // vurgu kelimeleri karanlik zeminde de rahat okunur.
          const accentColor =
            displayStatus === "safe" ? "var(--btn-success-text)" :
            displayStatus === "dangerous" ? "var(--btn-danger-text)" :
            displayStatus === "suspicious" ? "var(--btn-warning-text)" :
            "var(--btn-neutral-text)";
          // Iki vurgu: domain adi + verdict keyword. Ikisi de AYNI stil —
          // renk ve fontWeight paylasilir; goz "burada iki onemli sey var"
          // hissini tek tonda alir. Eskiden domain 600, keyword 700 ile
          // ayriliyordu; kullanici parite istedi.
          const dIdx = message.indexOf(siteName);
          const emphasisStyle = { color: accentColor, fontWeight: 700, whiteSpace: "nowrap" as const };
          const renderBody = (): React.ReactNode => {
            if (dIdx === -1) {
              const hIdx = message.indexOf(highlightWord);
              if (hIdx === -1) return message;
              return (
                <>
                  {message.slice(0, hIdx)}
                  <strong style={emphasisStyle}>{message.slice(hIdx, hIdx + highlightWord.length)}</strong>
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
                  <strong style={emphasisStyle}>{siteName}</strong>
                  {afterDomain}
                </>
              );
            }
            return (
              <>
                {beforeDomain}
                <strong style={emphasisStyle}>{siteName}</strong>
                {afterDomain.slice(0, hIdxAfter)}
                <strong style={emphasisStyle}>{afterDomain.slice(hIdxAfter, hIdxAfter + highlightWord.length)}</strong>
                {afterDomain.slice(hIdxAfter + highlightWord.length)}
              </>
            );
          };
          const messageNode = renderBody();
          return (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 4, perspective: "800px" }}>
                {/* Big logo with soft outer glow in the verdict colour — sits
                    flush against the bubble so the speech tail appears to
                    emerge straight from its edge. Hover lifts + tilts the
                    helmet slightly to feel alive. */}
                <DraggableLogo displayStatus={displayStatus} variant={variant} />
                {/* Bubble — soft tinted surface in the verdict colour, dark
                    body text for readability, with a small tail pointing
                    left into the logo. URL pinned to a separated bottom
                    strip with a globe icon. */}
                <div style={{
                  position: "relative",
                  // Bubble genisligini shrink-to-fit yap: flex icinde
                  // fit-content tek basina yetmediginden text-wrap: balance
                  // + max-width ile satirlari dengeleriz. Sag tarafta bariz
                  // beyaz alan kalmaz, wrap noktalari esitlenir.
                  flex: "0 1 auto",
                  minWidth: 0,
                  // Unknown durumunda: bubble bg panelden bir tik daha
                  // acik (paneldan bagimsiz aciklik disiplini). Border
                  // slate-400 net cizgi — bg'ler gri kaldigi icin
                  // balonu ayirt eder.
                  // Balon bg: paneldan bariz ayrilsin diye ozel --bubble-*-bg
                  // tokenlari. Light modda panel FDBA74 (koyu turuncu) iken
                  // bubble FEE2C6 (acik pastel turuncu) — goz balonu bulur.
                  background:
                    variant === "neutral" ? "var(--bubble-neutral-bg)" :
                    variant === "warning" ? "var(--bubble-warning-bg)" :
                    variant === "danger" ? "var(--bubble-danger-bg)" :
                    variant === "success" ? "var(--bubble-success-bg)" :
                    `var(--btn-${variant}-bg)`,
                  border: variant === "neutral"
                    ? "1px solid var(--bubble-neutral-border)"
                    : `1px solid var(--btn-${variant}-border)`,
                  borderRadius: 12,
                  color: "var(--text)",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  marginLeft: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 4, padding: "12px 10px 10px 12px", fontSize: 13.5, lineHeight: 1.5 }}>
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
                            e.currentTarget.style.background = "var(--accent-info-deep)";
                            e.currentTarget.style.transform = "scale(1.04)";
                            e.currentTarget.style.boxShadow = "0 3px 8px rgba(37, 99, 235, 0.40)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--accent-info)";
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.10)";
                          }}
                          style={{
                            flex: 1,
                            // Always corporate blue, regardless of verdict colour. The bubble
                            // already carries the warning hue; the button is a calm CTA that
                            // shouldn't panic the user when the site isn't confirmed-malicious.
                            background: "var(--accent-info)",
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
                  {/* Sola bakan tekil ucgen kuyruk (Alparslan yonu). Kare
                      rotate(45deg) trigger 4 kenarli bir rhombus verdigi
                      icin bazi kombinasyonlarda saga da bir "ok" gorunuyordu.
                      CSS border-triangle ile SADECE sola bakan tek uc bir
                      ucgen olusuruyoruz. Dis ucgen border rengi, ic ucgen
                      bubble bg — birinci ucgenin uzerinde 1px kaydirilmis. */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: -7,
                      top: 12,
                      width: 0,
                      height: 0,
                      borderTop: "7px solid transparent",
                      borderBottom: "7px solid transparent",
                      borderRight:
                        variant === "neutral"
                          ? "7px solid var(--bubble-neutral-border)"
                          : `7px solid var(--btn-${variant}-border)`,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: -6,
                      top: 13,
                      width: 0,
                      height: 0,
                      borderTop: "6px solid transparent",
                      borderBottom: "6px solid transparent",
                      borderRight:
                        variant === "neutral" ? "6px solid var(--bubble-neutral-bg)" :
                        variant === "warning" ? "6px solid var(--bubble-warning-bg)" :
                        variant === "danger" ? "6px solid var(--bubble-danger-bg)" :
                        variant === "success" ? "6px solid var(--bubble-success-bg)" :
                        `6px solid var(--btn-${variant}-bg)`,
                    }}
                  />
                </div>
              </div>

            </>
          );
        })() : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, flex: 1, minWidth: 0 }}>
            {/* Nokta hep title satirinin gorsel merkezi ile hizali kalmali —
                eski marginTop: -15 hack'i 2-satirli verdict goruntusunde
                calisiyordu ama displayDomain bos (loading / chrome://)
                durumlarda noktayi titrin uzerine itiyordu. Cozum:
                alignItems flex-start + dot'a sabit marginTop: 6 (24px
                title satir yuksekligi - 10px dot / 2 = ~7), boylece
                domain olsa da olmasa da hizali. */}
            <span
              style={{
                animation:
                  displayStatus === "loading" ? "loadingPulse 1.1s ease-in-out infinite" :
                  displayStatus === "safe" && enabled ? "safePulse 1.6s ease-out infinite" :
                  "none",
                boxShadow: displayStatus === "safe" && enabled ? "0 0 0 0 rgba(22, 163, 74, 0.45)" : "none",
                width: 10,
                height: 10,
                borderRadius: "50%",
                display: "inline-block",
                background:
                  displayStatus === "safe" ? "#16a34a" :
                  displayStatus === "dangerous" ? "#dc2626" :
                  displayStatus === "suspicious" ? "#d97706" : "#6b7280",
                marginTop: 7,
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
              <div style={{ fontWeight: 700, fontSize: 16, color: config?.color || "var(--text)" }}>
                {displayStatus === "loading"
                  ? <>{t.status.checking.replace(/\.+$/, "")}{loadingDots}</>
                  : config?.label}
              </div>
              {displayDomain && displayDomain !== "—" && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{displayDomain}</div>
              )}
            </div>
          </div>

          {/* Classic right-side: inline quick-whitelist for non-safe verdicts. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {/* Inline quick-add button \u2014 only shows on non-safe verdicts
                and disappears once the site is whitelisted. */}
            {displayStatus !== "loading" && !isWhitelisted && displayDomain && displayDomain !== "\u2014" &&
              (displayStatus === "dangerous" || displayStatus === "suspicious" || displayStatus === "unknown") && (
              <button
                // Asistan modundaki "Bu Adrese Güven" akisi ile bire bir ayni:
                // direkt whitelist'e eklemek yerine once onay modali aciliyor —
                // ikisinin davranisi farkli olursa kullanici hangi yolla
                // gectigine gore sonuc baska olur, kafa karistirici.
                // Modal asistan modundan bagimsiz; klasik gorunumde bile cikar.
                onClick={() => setShowTrustConfirm(true)}
                title={t.popupWhitelist.tooltipAdd}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--quick-whitelist-bg-hover)";
                  e.currentTarget.style.borderColor = "var(--quick-whitelist-border-hover)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--quick-whitelist-bg)";
                  e.currentTarget.style.borderColor = "var(--quick-whitelist-border)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                style={{
                  border: "1px solid var(--quick-whitelist-border)",
                  background: "var(--quick-whitelist-bg)",
                  color: "var(--quick-whitelist-text)",
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

/**
 * Suruklenerek 3D olarak dondurulen Alparslan logosu \u2014 bozuk para
 * gibi. Yatay drag \u2192 rotateY, dikey drag \u2192 rotateX. Bg + border +
 * SVG hepsi birlikte doner.
 *
 * Guzellestirmeler:
 *  - Drag sirasinda hafif buyume (scale 1.05) + shadow \u2014 "elinde
 *    tutuyorsun" hissi
 *  - Serbest birakinca momentum: son ~120ms'lik hiza gore coin
 *    kendi kendine bir sure daha doner (velocity * decay her frame),
 *    yavaslayarak durur
 *  - requestAnimationFrame ile 60fps akici hareket
 */
function DraggableLogo({
  displayStatus,
  variant,
}: {
  displayStatus: SecurityStatus;
  variant: string;
}) {
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Drag boyunca son hareketleri sakla (momentum icin son ~120ms'lik
  // hizi hesaplariz).
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startRotationX: number;
    startRotationY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
    velocityY: number;
  } | null>(null);
  const momentumRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const s = dragStateRef.current;
      if (!s) return;
      const deltaX = e.clientX - s.startX;
      const deltaY = e.clientY - s.startY;
      const now = performance.now();
      // Intro sayfasindaki animasyon ile TAM ayni: piksel delta cinsinden
      // velocity (dt bolmesi yok). Momentum'da direkt vx eklenecek,
      // fizik his intro'daki 3D coin ile bire bir esit.
      const instVx = e.clientX - s.lastX;
      const instVy = e.clientY - s.lastY;
      s.velocityX = s.velocityX * 0.3 + instVx * 0.7;
      s.velocityY = s.velocityY * 0.3 + instVy * 0.7;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.lastTime = now;
      setRotationY(s.startRotationY + deltaX);
      setRotationX(s.startRotationX - deltaY);
    };
    // Aciyi kisa yol icin [-180, 180]'e normalize et \u2014 rotate(350) == rotate(-10)
    // gorsel olarak; ancak decay ederken hedef 0'a en yakin uzunluktan
    // gidilsin diye once wrap ediyoruz. Boylece 3 tam donusten sonra
    // spring-back reversion 3 ters donus yapmiyor.
    const wrapAngle = (a: number) => (((a + 180) % 360) + 360) % 360 - 180;

    // Momentum bittikten sonra otomatik olarak devrolur \u2014 kullaniciyi acida
    // birakip donmez, yavas yavas 0'a doner.
    const runSpringBack = () => {
      setRotationX((p) => wrapAngle(p));
      setRotationY((p) => wrapAngle(p));
      const tick = () => {
        let done = true;
        setRotationX((prev) => {
          const next = prev * 0.88;
          if (Math.abs(next) > 0.3) done = false;
          return Math.abs(next) > 0.3 ? next : 0;
        });
        setRotationY((prev) => {
          const next = prev * 0.88;
          if (Math.abs(next) > 0.3) done = false;
          return Math.abs(next) > 0.3 ? next : 0;
        });
        if (!done) {
          momentumRafRef.current = requestAnimationFrame(tick);
        } else {
          momentumRafRef.current = null;
        }
      };
      momentumRafRef.current = requestAnimationFrame(tick);
    };

    const handleUp = () => {
      const s = dragStateRef.current;
      setIsDragging(false);
      if (!s) return;
      // Momentum: son hiz momentumRafRef ile decay ederek uygulanir.
      // Sadece belli bir esigin uzerindeki hizlarda calisir.
      // Intro sayfasi animasyonu ile TAM ayni parametreler:
      // - decay 0.94/frame, - direkt vx ekleme (carpansiz), - esik 0.05.
      if (Math.abs(s.velocityX) > 0.5 || Math.abs(s.velocityY) > 0.5) {
        let vx = s.velocityX;
        let vy = s.velocityY;
        const tick = () => {
          vx *= 0.94;
          vy *= 0.94;
          setRotationY((prev) => prev + vx);
          setRotationX((prev) => prev - vy);
          if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
            momentumRafRef.current = requestAnimationFrame(tick);
          } else {
            momentumRafRef.current = null;
            runSpringBack();
          }
        };
        momentumRafRef.current = requestAnimationFrame(tick);
      } else {
        runSpringBack();
      }
      dragStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // Component unmount olursa momentum'u iptal et \u2014 memory leak yok.
  useEffect(() => {
    return () => {
      if (momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`alparslan-bubble-logo alparslan-mood-${displayStatus}${isDragging ? " dragging" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        // Devam eden momentum varsa iptal et \u2014 yeni drag sifirdan
        // baslar.
        if (momentumRafRef.current !== null) {
          cancelAnimationFrame(momentumRafRef.current);
          momentumRafRef.current = null;
        }
        dragStateRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startRotationX: rotationX,
          startRotationY: rotationY,
          lastX: e.clientX,
          lastY: e.clientY,
          lastTime: performance.now(),
          velocityX: 0,
          velocityY: 0,
        };
        setIsDragging(true);
      }}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--logo-frame-bg)",
        border: `2px solid var(--btn-${variant}-border)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        marginTop: -2,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transformStyle: "preserve-3d",
        // 3D rotasyon + drag'de hafif buyume; hicbir golge / overlay YOK \u2014
        // logo her zaman saf ve temiz kalir.
        transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${isDragging ? 1.06 : 1})`,
        // Intro sayfasindaki `.intro-logo` ile birebir ayni transition
        // stratejisi: drag SIRASINDA transform anlik (1:1 fare takibi
        // icin), drag DEGILKEN (momentum + spring-back + rest) 0.35s
        // ease smoothing.
        transition: isDragging ? "none" : "transform 0.35s ease",
      }}
    >
      <img
        src="/icons/alparslan_logo.svg"
        alt="Alparslan"
        decoding="async"
        loading="eager"
        draggable={false}
        style={{
          width: "78%",
          height: "78%",
          imageRendering: "-webkit-optimize-contrast" as const,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
