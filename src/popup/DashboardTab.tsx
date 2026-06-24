import { useState, useEffect } from "react";
import type { DashboardData } from "@/dashboard/types";
import { type ScanHistoryEntry, HISTORY_DISPLAY_LIMIT } from "@/utils/types";
import t from "@/i18n/tr";
import { useCountUp } from "./useCountUp";

function getScoreColor(score: number): string {
  // Skor halkasinin esik renkleri — theme.ts'deki accent token'lariyla
  // birebir ayni hex, sadece tek kaynaktan okunuyor. Renk degistirmek
  // istenirse theme.ts yeterli, burayi dolasmaya gerek yok.
  if (score >= 80) return "var(--accent-success)";
  if (score >= 50) return "var(--accent-warning)";
  return "var(--accent-danger)";
}

export default function DashboardTab() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "GET_DASHBOARD_SCORE" },
      (response: { dashboard: DashboardData } | null) => {
        if (response?.dashboard) {
          setDashboard(response.dashboard);
        }
      },
    );
    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (response: { history: ScanHistoryEntry[] } | null) => {
      if (response?.history) setHistory(response.history);
    });

    // Reaktif yenileme — popup acikken arka planda olusan degisiklikleri
    // anlik yansitir:
    //   - SYNC settings degisirse (Tum Ayarlar'dan Detayli Guvenlik
    //     Taramasi toggle vs.) skor halkasi + analiz panosu yenilenir.
    //   - LOCAL history degisirse (yeni ziyaret eklendi) hem panel
    //     sayilari hem (Skor sekmesindeki) acik liste senkron kalır.
    const onStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "sync" && changes.settings) {
        chrome.runtime.sendMessage(
          { type: "GET_DASHBOARD_SCORE" },
          (response: { dashboard: DashboardData } | null) => {
            if (response?.dashboard) setDashboard(response.dashboard);
          },
        );
      }
      if (areaName === "local" && changes.history) {
        const next = changes.history.newValue as ScanHistoryEntry[] | undefined;
        if (Array.isArray(next)) setHistory(next);
        // Dashboard'i da yeniden cek; insightCounts background'da
        // history uzerinden hesaplandigi icin onun da taze gelmesi gerek.
        chrome.runtime.sendMessage(
          { type: "GET_DASHBOARD_SCORE" },
          (response: { dashboard: DashboardData } | null) => {
            if (response?.dashboard) setDashboard(response.dashboard);
          },
        );
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, []);

  const handleResetScore = () => {
    chrome.runtime.sendMessage({ type: "RESET_SCORE" }, () => {
      // Backend done — refetch the dashboard so the ring instantly snaps
      // back to 100 without requiring the user to reopen the popup.
      chrome.runtime.sendMessage(
        { type: "GET_DASHBOARD_SCORE" },
        (response: { dashboard: DashboardData } | null) => {
          if (response?.dashboard) setDashboard(response.dashboard);
        },
      );
    });
  };

  // SKOR HESABI POPUP TARAFINDA TEK KAYNAKTAN
  // ───────────────────────────────────────────────────────────────────────
  // Skor halkasinda gosterilen sayi, doğrudan asagidaki Skor Analizi
  // panosunda gorunen sayilardan hesaplanir. Backend `dashboard.score`
  // gondertse bile KULLANILMAZ — tek bir kaynak (panel sayilari), tek bir
  // formul. Boylece panel "3 risk -15 puan, +0 baska sey" diyorken halkanin
  // 0 yazip kullaniciyi kafaya vurmasi matematik olarak imkansiz.
  //
  // Sayilar oncelikle background'in gonderdigi insightCounts'tan okunur
  // (canonical); insightCounts henuz yuklenmemisse popup kendi history
  // state'inden hesaplar. Iki kaynak da olmazsa hepsi 0 kabul edilir
  // (skor = 100).
  const ic = dashboard?.insightCounts;
  const uniqueSafeCount = ic?.uniqueSafe ?? new Set(
    history.filter((h) => h.level === "SAFE").map((h) => h.domain),
  ).size;
  const uniqueThreatCount = ic?.uniqueThreat ?? new Set(
    history
      .filter((h) => h.level === "DANGEROUS" || h.level === "SUSPICIOUS")
      .map((h) => h.domain),
  ).size;
  const uniqueUnknownCount = ic?.uniqueUnknown ?? new Set(
    history.filter((h) => h.level === "UNKNOWN").map((h) => h.domain),
  ).size;
  // Formul: 100 baslangic
  //   − tehdit  × 10
  //   − risk    × 5
  //   + guvenli × 1
  //   + (tehdit yoksa +10 odul)
  //   + (risk yoksa  +5  odul)
  // Odul mantigi: "ceza" yerine "odul" framing'i ile kullaniciya pozitif
  // pekistirme; hem panel rozetinde "+10/+5 Puan" yesil olarak gosterilir
  // hem de skora gercekten eklenir. Tavan 100, taban 0 ile sinirli.
  const threatClean = uniqueThreatCount === 0;
  const riskClean = uniqueUnknownCount === 0;
  const computedScore = Math.max(
    0,
    Math.min(
      100,
      100
        - uniqueThreatCount * 10
        - uniqueUnknownCount * 5
        + uniqueSafeCount * 1
        + (threatClean ? 10 : 0)
        + (riskClean ? 5 : 0),
    ),
  );
  const animatedScore = useCountUp(computedScore, 300);

  if (!dashboard) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
        {t.loading}
      </div>
    );
  }

  const scoreColor = getScoreColor(computedScore);

  // Extra-compact ring: 130x130 with 52px radius — keeps the whole Skor
  // tab within the popup viewport (no scrollbar).
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  // Arc dolulugu da animasyonlu skora baglanir: sayi yuvarlandikca halkanin
  // dolu kismi da senkron ilerler, tek bir "canli" hareketmis hissi verir.
  const filledArc = (Math.min(animatedScore, 100) / 100) * ringCircumference;
  const messages = computedScore >= 80
    ? { title: t.scoreRing.safeTitle, subtitle: t.scoreRing.safeSubtitle }
    : computedScore >= 50
      ? { title: t.scoreRing.mediumTitle, subtitle: t.scoreRing.mediumSubtitle }
      : { title: t.scoreRing.riskyTitle, subtitle: t.scoreRing.riskySubtitle };

  return (
    <div style={{ padding: 14, background: "var(--surface)" }}>
      {/* Title above the ring — sag tarafta yardim (?) ikonu hover'da
          skor hesaplama formulunu gosterir. Statik mesaj, anlik hesaplama
          icermez; "100 uzerinden tehlikeli -10, supheli -5, guvenli +1"
          gibi kullanicinin bir bakista anladigi kisa not. */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: 0.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Günlük Skor
          <ScoreHelpTooltip />
        </div>
      </div>

      {/* Score ring — outer-only glow.
          We can't use `filter: drop-shadow` on the SVG itself because the
          drop-shadow follows the arc shape, which means a halo bleeds into
          the hollow centre of the ring. Instead, we put a perfect-circle
          spacer div behind the SVG sized to match the ring's outer edge
          (114px) and give IT a `box-shadow`. The shadow extends OUTWARD
          from that circle's border only, never inside, leaving the ring
          centre completely clean. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 10,
          position: "relative",
        }}
      >
        <div style={{ position: "relative", width: 130, height: 130 }}>
          {/* Outer glow source — invisible 114px circle (= ring outer
              diameter), purely there to anchor an outward box-shadow. */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 114,
              height: 114,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              boxShadow: `0 4px 10px ${scoreColor}55, 0 12px 24px ${scoreColor}30`,
              pointerEvents: "none",
            }}
          />

          <svg width="130" height="130" viewBox="0 0 130 130" style={{ display: "block", position: "relative" }}>
            <circle cx="65" cy="65" r={ringRadius} stroke="var(--ring-track)" strokeWidth="10" fill="none" />
            <circle
              cx="65"
              cy="65"
              r={ringRadius}
              stroke={scoreColor}
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${filledArc} ${ringCircumference}`}
              strokeLinecap="round"
              transform="rotate(-90 65 65)"
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          </svg>

          {/* Shield + score centred over the ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div data-testid="dashboard-score" style={{ fontSize: 30, fontWeight: 800, color: scoreColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {animatedScore}
            </div>
            <div style={{ fontSize: 12, color: scoreColor, fontWeight: 600, marginTop: 2, opacity: 0.85 }}>
              /100
            </div>
          </div>
        </div>
      </div>

      {/* Status message — colour matches the ring */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor, lineHeight: 1.35 }}>
          {messages.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {messages.subtitle}
        </div>
      </div>

      {/* Divider with checkmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: scoreColor, opacity: 0.4 }} />
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: `2px solid ${scoreColor}`,
            color: scoreColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div style={{ flex: 1, height: 1, background: scoreColor, opacity: 0.4 }} />
      </div>

      {/* Skor Analizi — divider'in altinda gelen "neden bu skor?" panosu.
          Veriler skor halkasiyla AYNI kaynaktan gelir (history'den benzersiz
          domain sayilari + settings). Boylece skor (orn. 60), -X Puan
          rozetleri ve gosterilen sayilar arasinda hicbir uyusmamazlik
          olmaz. */}
      {(() => {
        // Panel sayilari skorun hesabi ile AYNI degiskenleri kullanir
        // (uniqueSafeCount, uniqueThreatCount, vs.) — boylece halka ve panel
        // birebir aynı veriden besleniyor, tutarsizlik imkansiz.
        const uniqueSafeDomains = uniqueSafeCount;
        const uniqueThreatDomains = uniqueThreatCount;
        const uniqueUnknownDomains = uniqueUnknownCount;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {/* Bolum basligi: dikey gradient accent cubuk + temiz tipografi. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div
                style={{
                  width: 3,
                  height: 12,
                  borderRadius: 2,
                  background: "linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%)",
                }}
              />
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                {t.skorBreakdown.title}
              </div>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--border) 0%, transparent 100%)" }} />
            </div>

            {/* Guvenli ziyaret bonusu — her benzersiz SAFE domain +1 puan.
                EN USTTE yer alir cunku olumlu davranisi/odullendirmeyi en
                onceki goz teması yapar. 0'sa "Henuz guvenli ziyaret yok"
                bilgisi nezaket icin gosterilir. */}
            {uniqueSafeDomains > 0 ? (
              <ScoreInsight
                tone="success"
                text={t.skorBreakdown.safeActive(uniqueSafeDomains)}
                delta={uniqueSafeDomains}
              />
            ) : (
              <ScoreInsight tone="success" text={t.skorBreakdown.safeClean} />
            )}

            {/* Tehdit — benzersiz domain bazinda, her biri -10 puan;
                tehdit yoksa +10 odul. */}
            {uniqueThreatDomains > 0 ? (
              <ScoreInsight
                tone="warning"
                text={t.skorBreakdown.threatActive(uniqueThreatDomains)}
                delta={-(uniqueThreatDomains * 10)}
              />
            ) : (
              <ScoreInsight
                tone="success"
                text={t.skorBreakdown.threatClean}
                delta={10}
              />
            )}

            {/* Risk — benzersiz UNKNOWN domain bazinda, her biri -5 puan;
                risk yoksa +5 odul. */}
            {uniqueUnknownDomains > 0 ? (
              <ScoreInsight
                tone="warning"
                text={t.skorBreakdown.riskActive(uniqueUnknownDomains)}
                delta={-(uniqueUnknownDomains * 5)}
              />
            ) : (
              <ScoreInsight
                tone="success"
                text={t.skorBreakdown.riskClean}
                delta={5}
              />
            )}

          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Sade altta "Skoru sıfırla" link — kullanıcı tum verileri silmeden
            sadece skorunu temiz bir sayfaya dondurebilsin. */}
        <button
          onClick={() => setShowResetConfirm(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.background = "var(--surface-card-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-faint)";
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            marginTop: 4,
            padding: "5px 10px",
            border: "none",
            background: "transparent",
            color: "var(--text-faint)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            borderRadius: 6,
            alignSelf: "center",
            transition: "all 0.15s ease",
          }}
        >
          ↺ {t.resetScore.button}
        </button>
      </div>

      {showResetConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
              maxWidth: 320,
              boxShadow: "0 14px 36px rgba(0,0,0,0.30)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
              {t.resetScore.confirmTitle}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
              {t.resetScore.confirmBody}
            </div>
            {/* Buton hiyerarsi: Kullanici "Skoru sifirla"ya bilerek tikladi —
                yani "Evet, Sifirla" niyet edilen birincil eylem; o yuzden
                dolgun mavi + soldaki yer onun. "Vazgec" ikincil/escape route
                olarak sade outline'da kalir. Tersi olunca kullanici refleksle
                mavi butona basip iptal ediyor, sifirlanmiyor.
                Vertical align: line-height=1 + display:flex + alignItems
                center her iki butonda metni dikeyde tam ortalar (font weight
                farkindan dogan kayma artik yok). */}
            <div style={{ display: "flex", gap: 8, maxWidth: 240, margin: "0 auto" }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 10px",
                  background: "var(--accent-navy)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 5px rgba(30,58,138,0.30)",
                  transition: "transform 0.15s ease",
                }}
              >
                {t.resetScore.confirmCancel}
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  handleResetScore();
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 10px",
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 500,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "transform 0.15s ease",
                }}
              >
                {t.resetScore.confirmYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Skor Analizi panosundaki tek bir aciklama satiri. tone'a gore renk
// "Günlük Skor" yazisinin yanindaki yardim ikonu — hover'da statik bir
// not gosterir. Skorun nasil hesaplandigini kisa anlatir; anlik degerler
// yok, formul bilgisi var. Standart "?" karakter degil, gercek soru-isaretli
// daire SVG (cogu web sitesinde gorulen tarzda).
function ScoreHelpTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        aria-label="Skor nasıl hesaplanır?"
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "var(--surface-card)",
          border: "1.5px solid var(--text-muted)",
          color: "var(--text-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          transition: "all 0.15s ease",
        }}
      >
        {/* "?" karakteri yerine SVG — webde standart yardim ikonu */}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: "50%",
            transform: "translateX(50%)",
            width: 240,
            padding: "8px 10px",
            background: "var(--text)",
            color: "var(--surface-card)",
            fontSize: 11,
            lineHeight: 1.45,
            fontWeight: 500,
            borderRadius: 8,
            boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
            zIndex: 50,
            textAlign: "left",
            letterSpacing: 0,
          }}
        >
          Skor 100 üzerinden hesaplanır. Her bir tehlikeli site <strong>-10</strong>, her bir şüpheli
          durum <strong>-5</strong>, her bir güvenli site <strong>+1</strong> puandır. Toplam puanınız
          en fazla 100 olabilir.
          {/* Tooltip ucu (Dxn'dan asagi bakan ucgen) */}
          <div
            style={{
              position: "absolute",
              top: -5,
              right: "50%",
              transform: "translateX(50%) rotate(45deg)",
              width: 9,
              height: 9,
              background: "var(--text)",
            }}
          />
        </div>
      )}
    </span>
  );
}

// (warning = kirmizi, success = yesil), opsiyonel delta (puan etkisi) ile
// sag tarafta pill rozet gosterir. delta verilmezse rozet yerine sadece
// metin gozukur — "olumlu durum" (tehdit yok / ayar acik) icin kullanilir.
function ScoreInsight({
  tone,
  text,
  delta,
}: {
  tone: "warning" | "success";
  text: string;
  delta?: number;
}) {
  const isWarn = tone === "warning";
  // Accent rengi theme.ts'deki tek noktadan beslenir; eski inline hex
  // (#dc2626 / #16a34a) ile birebir ayni deger.
  const accent = isWarn ? "var(--accent-danger)" : "var(--accent-success)";
  const animatedDelta = useCountUp(delta ?? 0, 300);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px 9px 10px",
        background: isWarn
          ? "linear-gradient(135deg, rgba(220, 38, 38, 0.06) 0%, rgba(220, 38, 38, 0.015) 100%)"
          : "linear-gradient(135deg, rgba(22, 163, 74, 0.06) 0%, rgba(22, 163, 74, 0.015) 100%)",
        border: `1px solid ${isWarn ? "rgba(220, 38, 38, 0.14)" : "rgba(22, 163, 74, 0.14)"}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 9,
        fontSize: 11,
        color: "var(--text)",
        lineHeight: 1.4,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* Status dot: solid renkli daire + halka glow. */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 0 3px ${isWarn ? "rgba(220, 38, 38, 0.16)" : "rgba(22, 163, 74, 0.16)"}`,
          flexShrink: 0,
        }}
      />

      <span style={{ flex: 1, fontWeight: 500, opacity: 0.95 }}>{text}</span>

      {/* Sadece negatif puan etkisi varsa pill rozeti goster.
          Iyi durumlarda (tehdit yok, ayar acik) sag tarafa rozet basmiyoruz —
          olumlu cumle kendi basina yeterli, sahte bir "(+0 Puan)" rozeti
          kafa karistirir. */}
      {delta !== undefined && delta !== 0 && (
        <span
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "baseline",
            gap: 3,
            padding: "3px 9px",
            borderRadius: 999,
            background: accent,
            color: "white",
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: 0.2,
            fontVariantNumeric: "tabular-nums",
            boxShadow: `0 2px 5px ${isWarn ? "rgba(220, 38, 38, 0.25)" : "rgba(22, 163, 74, 0.25)"}`,
          }}
        >
          <span>
            {animatedDelta >= 0 ? "+" : ""}
            {animatedDelta}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>
            {t.skorBreakdown.pointSuffix}
          </span>
        </span>
      )}
    </div>
  );
}

// yükselten/düşüren/nedir butonlarının görsel kalıbını (DashboardActionButton)
// birebir kullanır. Tiklayinca o kategorinin tarama listesi acilir/kapanir.
// `active` durumunda sağdaki ">" oku aşağı doner ki kullanici hangi kartin
// acik oldugunu net gorur.
export function SkorCountButton({
  icon,
  label,
  activeLabel,
  zeroText,
  value,
  variant,
  active,
  onClick,
  title,
  activeTitle,
}: {
  icon: string;
  label: string;
  activeLabel?: string;
  zeroText: string;
  value: number;
  variant: "success" | "danger" | "info" | "neutral";
  active: boolean;
  onClick: () => void;
  /** Hover'da gosterilecek native tooltip (kart kapaliyken). */
  title?: string;
  /** Hover'da gosterilecek native tooltip (kart acikken). */
  activeTitle?: string;
}) {
  const v = `--btn-${variant}`;
  // "Canli odometre": kart acildiginda sayi 0'dan baslayip kisa surede
  // gercek degerine yuvarlanir. Statik bir rakam yerine "sayilar an be an
  // sayiliyor" hissi verir.
  const animatedValue = useCountUp(value, 300);
  return (
    <button
      onClick={onClick}
      title={active && activeTitle ? activeTitle : title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `var(${v}-bg-hover)`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `var(${v}-bg)`;
        e.currentTarget.style.transform = "translateY(0)";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        background: `var(${v}-bg)`,
        border: `1.5px solid var(${v}-border)`,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        color: `var(${v}-text)`,
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
        cursor: "pointer",
        transition: "all 0.18s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: 15 }}>{icon}</span>
      <span style={{ flex: 1 }}>{active && activeLabel ? activeLabel : label}</span>
      {value > 0 ? (
        <span style={{ fontSize: 15, fontWeight: 800, flexShrink: 0, minWidth: 20, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{animatedValue}</span>
      ) : (
        // Bos durumda uzun cumle ("Tehlikeli adres bulunmadi") yer kapliyordu;
        // label zaten ne sayildigini soyluyor, "0" tek basina yeterli ve
        // butun butonlarda layout dengesi korunuyor. zeroText prop'u native
        // tooltip'te tasiniyor (`activeTitle` / `title` yedek).
        <span
          title={zeroText}
          style={{ fontSize: 15, fontWeight: 800, flexShrink: 0, minWidth: 20, textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.4 }}
        >
          0
        </span>
      )}
      <span
        style={{
          fontSize: 13,
          opacity: 0.7,
          flexShrink: 0,
          transition: "transform 0.2s ease",
          transform: active ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        ›
      </span>
    </button>
  );
}

// Tiklanan sayacin filtreli tarama gecmisi listesini gosterir. Durum
// sekmesindeki liste UI'siyla ayni gorunum: list-surface arka plani, baslik
// cubugu, kaydirilabilir satirlar, badge'li seviye etiketleri.
export function SkorFilteredList({
  filter,
  history,
}: {
  filter: "control" | "threat" | "unknown";
  history: ScanHistoryEntry[];
}) {
  const filtered = history.filter((item) => {
    if (filter === "threat") return item.level === "DANGEROUS" || item.level === "SUSPICIOUS";
    if (filter === "unknown") return item.level === "UNKNOWN";
    return true; // control = tümü
  });
  const title =
    filter === "threat" ? t.filterLists.threatList :
    filter === "unknown" ? t.filterLists.unknownList :
    t.filterLists.controlList;
  const emptyMessage =
    filter === "threat" ? t.filterLists.threatEmpty :
    filter === "unknown" ? t.filterLists.unknownEmpty :
    t.history.empty;
  const emptyColor = filter === "threat" ? "#16a34a" : "#9ca3af";
  // Filter'a gore renk tonu: threat -> kirmizi, unknown -> mavi, control ->
  // notr. Wrapper'a hafif tint + uyumlu kenar, basliga daha yogun tint +
  // accent renkli yazi. Kart ust gostergesi ile gorsel butunluk saglar.
  const accent =
    filter === "threat" ? "#dc2626" :
    filter === "unknown" ? "#2563eb" :
    null;
  const wrapperBg =
    filter === "threat" ? "rgba(220, 38, 38, 0.04)" :
    filter === "unknown" ? "rgba(37, 99, 235, 0.04)" :
    "var(--list-surface)";
  const wrapperBorder =
    filter === "threat" ? "rgba(220, 38, 38, 0.20)" :
    filter === "unknown" ? "rgba(37, 99, 235, 0.20)" :
    "var(--border)";
  const titleBg =
    filter === "threat" ? "rgba(220, 38, 38, 0.10)" :
    filter === "unknown" ? "rgba(37, 99, 235, 0.10)" :
    "var(--list-surface-title)";
  const titleColor = accent ?? "var(--text)";
  const titleBorder =
    filter === "threat" ? "rgba(220, 38, 38, 0.18)" :
    filter === "unknown" ? "rgba(37, 99, 235, 0.18)" :
    "var(--border)";
  const shown = filtered.slice(0, HISTORY_DISPLAY_LIMIT);
  return (
    <div className="history-panel-drop" style={{ background: wrapperBg, borderRadius: 10, overflow: "hidden", border: `1px solid ${wrapperBorder}` }}>
      <div
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          color: titleColor,
          background: titleBg,
          borderBottom: `1px solid ${titleBorder}`,
          letterSpacing: 0.3,
        }}
      >
        {title}
      </div>
      <div className="alparslan-thin-scroll" style={{ maxHeight: 180, overflowY: "auto" }}>
        {shown.length === 0 ? (
          <div style={{ padding: "12px 16px", fontSize: 12, color: emptyColor, textAlign: "center" }}>
            {emptyMessage}
          </div>
        ) : (
          shown.map((entry, i) => (
            <div
              key={i}
              className="history-row-stagger"
              style={{
                padding: "6px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
                animationDelay: `${Math.min(i, 12) * 25}ms`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                  {entry.domain}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                  {new Date(entry.checkedAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  color: entry.level === "SAFE" ? "#166534" : entry.level === "DANGEROUS" ? "#dc2626" : entry.level === "SUSPICIOUS" ? "#d97706" : "#6b7280",
                  background: entry.level === "SAFE" ? "#dcfce7" : entry.level === "DANGEROUS" ? "#fef2f2" : entry.level === "SUSPICIOUS" ? "#fffbeb" : "#f3f4f6",
                }}
              >
                {entry.level === "SAFE" ? t.status.safe : entry.level === "DANGEROUS" ? "Tehlikeli" : entry.level === "SUSPICIOUS" ? t.status.suspicious : t.status.unknown}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Variant-driven button — pulls bg/border/text from CSS variables defined in
// theme.ts so the same JSX adapts to light & dark mode automatically.
