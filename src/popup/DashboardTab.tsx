import { useState, useEffect, useRef } from "react";
import type { DashboardData } from "@/dashboard/types";
import { type ScanHistoryEntry, HISTORY_DISPLAY_LIMIT } from "@/utils/types";
import t from "@/i18n/tr";
import { useCountUp } from "./useCountUp";
import { TabLoadingPlaceholder } from "./components/TabLoadingPlaceholder";
import { filterToVariant } from "./components/DurumSkorCards";

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
  // Skor Analizi panosunda "Detayli Goruntule" acik mi. Tek button ile
  // tum insight satirlarindaki domain listelerini birlikte acar/kapatir.
  const [scoreDetailsOpen, setScoreDetailsOpen] = useState(false);
  const scoreToggleRef = useRef<HTMLButtonElement | null>(null);

  // Skor Analizi acilinca panel gorunur olsun diye scroll asagi iner;
  // kapanınca kullanici baslangıc konumunu tekrar gorsun diye scroll en
  // ustee cikar. `.alparslan-thin-scroll` popup'ın tab-content wrapper'i.
  const toggleScoreDetails = () => {
    const nextOpen = !scoreDetailsOpen;
    setScoreDetailsOpen(nextOpen);
    const scroller = scoreToggleRef.current?.closest(".alparslan-thin-scroll") as HTMLElement | null;
    if (!scroller) return;
    if (nextOpen) {
      // Panel grid-template-rows animasyonu ile ic yukseklik kademeli
      // buyur — her frame'de scrollTop'u scrollHeight'a itiyoruz ki
      // scroll bar panel ile birlikte anlik olarak en dibe insin.
      // Toplam sure 400ms; accordion 320ms + kucuk bir margin.
      const start = performance.now();
      const tick = () => {
        scroller.scrollTop = scroller.scrollHeight;
        if (performance.now() - start < 400) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    } else {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
  // Detay listelerine (ScoreInsight domains prop'u icin) benzersiz domain
  // listelerini de cikariyoruz. En yeni ziyaret ilk siradadir.
  const uniqueDomainsByLevel = (predicate: (h: ScanHistoryEntry) => boolean) => {
    const seen = new Set<string>();
    const out: string[] = [];
    const sorted = [...history]
      .filter(predicate)
      .sort((a, b) => b.checkedAt - a.checkedAt);
    for (const entry of sorted) {
      if (!seen.has(entry.domain)) {
        seen.add(entry.domain);
        out.push(entry.domain);
      }
    }
    return out;
  };
  const uniqueSafeDomainsList = uniqueDomainsByLevel((h) => h.level === "SAFE");
  const uniqueThreatDomainsList = uniqueDomainsByLevel(
    (h) => h.level === "DANGEROUS" || h.level === "SUSPICIOUS",
  );
  const uniqueUnknownDomainsList = uniqueDomainsByLevel((h) => h.level === "UNKNOWN");
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
    return <TabLoadingPlaceholder label="Skor" />;
  }

  const scoreColor = getScoreColor(computedScore);

  // Extra-compact ring: 130x130 with 52px radius — keeps the whole Skor
  // tab within the popup viewport (no scrollbar).
  const ringRadius = 54;
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
    <div style={{ padding: 14, background: "var(--surface)", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Title above the ring — sag tarafta yardim (?) ikonu hover'da
          skor hesaplama formulunu gosterir. Statik mesaj, anlik hesaplama
          icermez; "100 uzerinden tehlikeli -10, supheli -5, guvenli +1"
          gibi kullanicinin bir bakista anladigi kisa not. */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 14,
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
        <div style={{ position: "relative", width: 134, height: 134 }}>
          {/* Outer glow source — invisible 110px circle (= ring outer
              diameter), purely there to anchor an outward box-shadow. */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 118,
              height: 118,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              boxShadow: `0 4px 10px ${scoreColor}55, 0 11px 23px ${scoreColor}30`,
              pointerEvents: "none",
            }}
          />

          <svg width="134" height="134" viewBox="0 0 134 134" style={{ display: "block", position: "relative" }}>
            <circle cx="67" cy="67" r={ringRadius} stroke="var(--ring-track)" strokeWidth="9" fill="none" />
            <circle
              cx="67"
              cy="67"
              r={ringRadius}
              stroke={scoreColor}
              strokeWidth="9"
              fill="none"
              strokeDasharray={`${filledArc} ${ringCircumference}`}
              strokeLinecap="round"
              transform="rotate(-90 67 67)"
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
            <div data-testid="dashboard-score" style={{ fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {animatedScore}
            </div>
            <div style={{ fontSize: 12.5, color: scoreColor, fontWeight: 600, marginTop: 2, opacity: 0.85 }}>
              /100
            </div>
          </div>
        </div>
      </div>

      {/* Status message — colour matches the ring */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor, lineHeight: 1.35 }}>
          {messages.title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
          {messages.subtitle}
        </div>
      </div>

      {/* Divider with checkmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 30, marginTop: "auto", paddingTop: 0 }}>
            {/* Bolum basligi bir toggle button — tiklaninca panelin
                icerdigi 3 insight satiri + domain listeleri acilir/kapanir.
                Chevron 180deg doner. */}
            <button
              ref={scoreToggleRef}
              type="button"
              onClick={toggleScoreDetails}
              aria-expanded={scoreDetailsOpen}
              title={scoreDetailsOpen ? "Skor analizini gizle" : "Skor analizini göster"}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-card-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "6px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
                width: "100%",
                borderRadius: 6,
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                {scoreDetailsOpen ? "Skor Analizini Gizle" : t.skorBreakdown.title}
              </div>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  transform: scoreDetailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Guvenli ziyaret bonusu — her benzersiz SAFE domain +1 puan.
                EN USTTE yer alir cunku olumlu davranisi/odullendirmeyi en
                onceki goz teması yapar. 0'sa "Henuz guvenli ziyaret yok"
                bilgisi nezaket icin gosterilir. */}
            {/* Panelin kendisi collapsible: Skor Analizi baslik toggle'a
                bagli. Kapali iken 3 satir + domain listeleri hep birlikte
                gizli. Yumusak grid-template-rows animasyonu. */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: scoreDetailsOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {uniqueSafeDomains > 0 ? (
                    <ScoreInsight
                      tone="success"
                      text={t.skorBreakdown.safeActive(uniqueSafeDomains)}
                      delta={uniqueSafeDomains}
                      domains={uniqueSafeDomainsList}
                    />
                  ) : (
                    <ScoreInsight tone="success" text={t.skorBreakdown.safeClean} />
                  )}

                  {uniqueThreatDomains > 0 ? (
                    <ScoreInsight
                      tone="warning"
                      text={t.skorBreakdown.threatActive(uniqueThreatDomains)}
                      delta={-(uniqueThreatDomains * 10)}
                      domains={uniqueThreatDomainsList}
                    />
                  ) : (
                    <ScoreInsight
                      tone="success"
                      text={t.skorBreakdown.threatClean}
                      delta={10}
                    />
                  )}

                  {uniqueUnknownDomains > 0 ? (
                    <ScoreInsight
                      tone="suspicious"
                      text={t.skorBreakdown.riskActive(uniqueUnknownDomains)}
                      delta={-(uniqueUnknownDomains * 5)}
                      domains={uniqueUnknownDomainsList}
                    />
                  ) : (
                    <ScoreInsight
                      tone="success"
                      text={t.skorBreakdown.riskClean}
                      delta={5}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* "Skoru sıfırla" — sadece Skor Analizi paneli acikken gorunur;
            kullanicinin gozune direkt aksiyon niteliginde olmasin. */}
        {scoreDetailsOpen && (
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
        )}
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
            background: "var(--tooltip-bg)",
            color: "var(--tooltip-text)",
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
              background: "var(--tooltip-bg)",
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
  domains,
}: {
  tone: "warning" | "success" | "suspicious";
  text: string;
  delta?: number;
  /** Insight'i besleyen benzersiz domain listesi. Var ve dolu ise
   *  satirin sag tarafina zarif bir chevron cikar; tiklaninca satirin
   *  altinda yumusak bir animasyonla liste acilir. */
  domains?: string[];
}) {
  const isDanger = tone === "warning";
  const isSuspicious = tone === "suspicious";
  // Accent rengi theme.ts'deki tek noktadan beslenir. Suspicious icin
  // turuncu (--accent-warning), danger icin kirmizi.
  const accent = isSuspicious
    ? "var(--accent-warning)"
    : isDanger
    ? "var(--accent-danger)"
    : "var(--accent-success)";
  // Tone bazli tint renkleri — insight kartinin bg gradyani, border,
  // dot glow ve pill shadow icin ayni RGB temel.
  const tint = isSuspicious
    ? { rgb: "217, 119, 6" }
    : isDanger
    ? { rgb: "220, 38, 38" }
    : { rgb: "22, 163, 74" };
  const animatedDelta = useCountUp(delta ?? 0, 300);
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = !!domains && domains.length > 0;
  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(${tint.rgb}, 0.06) 0%, rgba(${tint.rgb}, 0.015) 100%)`,
        border: `1px solid rgba(${tint.rgb}, 0.14)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 9,
        color: "var(--text)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 11px 9px 10px",
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        {/* Status dot: solid renkli daire + halka glow. */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 0 3px rgba(${tint.rgb}, 0.16)`,
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
              boxShadow: `0 2px 5px rgba(${tint.rgb}, 0.25)`,
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

        {/* Chevron — sadece bu insight'in domain listesi varsa. Tiklaninca
            satirin altinda liste acilir/kapanir. */}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            title={showDetails ? "Detayı gizle" : "Detayı göster"}
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}

      </div>

      {hasDetails && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: showDetails ? "1fr" : "0fr",
            transition: "grid-template-rows 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div
              className="alparslan-thin-scroll"
              style={{
                padding: "0 12px 10px 22px",
                maxHeight: 140,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {domains!.map((d) => (
                <div
                  key={d}
                  title={d}
                  style={{
                    fontSize: 10.5,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.5,
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// yükselten/düşüren/nedir butonlarının görsel kalıbını (DashboardActionButton)
// birebir kullanır. Tiklayinca o kategorinin tarama listesi acilir/kapanir.
// `active` durumunda sağdaki ">" oku aşağı doner ki kullanici hangi kartin
// acik oldugunu net gorur.
export function SkorCountButton({
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
  label: string;
  activeLabel?: string;
  zeroText: string;
  value: number;
  variant: "success" | "danger" | "info" | "warning" | "neutral";
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
        // Aktif iken alt kenarlar duz — icerdeki liste butonun devami
        // gibi gorunsun. Bottom border da liste ile paylasilir hisse
        // dusurulur (ince cizgi kalir ama gorsel butunluk).
        borderRadius: active ? "10px 10px 0 0" : 10,
        borderBottomWidth: active ? 1 : 1.5,
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
      {/* Sol taraftaki kucuk yuvarlak dot — variant text renginde,
          Apple System Settings satirlarindaki gibi. Ikon yerine
          gecmez ama butonun sol tarafi bos kalmaz, kucuk bir gorsel
          kimlik verir. */}
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: `var(${v}-text)`,
          flexShrink: 0,
        }}
      />
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
  // Progressive disclosure: baslangicta 50 satir, "Daha fazla goster"
  // ile her tiklamada 50'ser artar. Popup icinde 2000+ satiri anda
  // render etmek maliyetli olurdu; kullanici gerektikce genisletir.
  const [visibleCount, setVisibleCount] = useState(HISTORY_DISPLAY_LIMIT);
  const emptyMessage =
    filter === "threat" ? t.filterLists.threatEmpty :
    filter === "unknown" ? t.filterLists.unknownEmpty :
    t.history.empty;
  // "Bulunamadi" mesaji her filter kendi variant rengiyle: control→info
  // mavi, threat→danger kirmizi, unknown→neutral gri. Boylece bos liste
  // mesaji da butonun/kartinin kimligiyle konusur.
  const emptyColor =
    filter === "threat" ? "var(--btn-danger-text)" :
    filter === "unknown" ? "var(--btn-neutral-text)" :
    "var(--btn-info-text)";
  // Variant filterToVariant() helper'indan gelir — sayac butonu ile
  // liste TEK kaynaktan tetiklenir. Buton bg'sini degistirirsen liste
  // otomatik ayni bg'yi alir; senkron uyusmazlik imkansiz.
  const variant = filterToVariant(filter);
  const shown = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  return (
    <div
      className="history-panel-drop"
      style={{
        background: `var(--btn-${variant}-bg)`,
        borderRadius: "0 0 10px 10px",
        overflow: "hidden",
        border: `1px solid var(--btn-${variant}-border)`,
        borderTop: "none",
        // Container gap: 8 → butonla liste arasinda bosluk kaliyordu.
        // -8 ile bu gap'i tam kapatiyoruz; buton alt kenarindan liste
        // dogrudan devam eder.
        marginTop: -8,
      }}
    >
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
                  color:
                    entry.level === "SAFE" ? "var(--btn-success-text)" :
                    entry.level === "DANGEROUS" ? "var(--btn-danger-text)" :
                    entry.level === "SUSPICIOUS" ? "var(--btn-warning-text)" :
                    "var(--btn-neutral-text)",
                  background:
                    entry.level === "SAFE" ? "var(--btn-success-bg)" :
                    entry.level === "DANGEROUS" ? "var(--btn-danger-bg)" :
                    entry.level === "SUSPICIOUS" ? "var(--btn-warning-bg)" :
                    "var(--btn-neutral-bg)",
                }}
              >
                {entry.level === "SAFE" ? t.status.safe : entry.level === "DANGEROUS" ? "Tehlikeli" : entry.level === "SUSPICIOUS" ? t.status.suspicious : t.status.unknown}
              </span>
            </div>
          ))
        )}
        {hasMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + HISTORY_DISPLAY_LIMIT)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
              color: "var(--text-muted)",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s ease",
            }}
          >
            Daha fazla göster ({filtered.length - visibleCount} kalan)
          </button>
        )}
      </div>
    </div>
  );
}

// Variant-driven button — pulls bg/border/text from CSS variables defined in
// theme.ts so the same JSX adapts to light & dark mode automatically.
