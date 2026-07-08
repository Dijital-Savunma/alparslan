import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { DEFAULT_SETTINGS, type ExtensionSettings, ThreatLevel, type ScanHistoryEntry } from "@/utils/types";
import { useScanHistory } from "@/popup/hooks/useScanHistory";
import { useProtectedDays } from "@/popup/hooks/useProtectedDays";
import { normalizeWhitelistInput } from "@/utils/whitelist-normalize";
import { ConfirmModal } from "@/components/ConfirmModal";
import t from "@/i18n/tr";

type OptionsSection = "general" | "whitelist" | "notifications";

/** Sayfa basina eleman secenekleri — kullanici uzun listelerde daha az
 *  scroll ile daha cok gormek isteyebilir. */
const WHITELIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/**
 * Options sayfasi — sol sidebar navigasyon + sag icerik paneli.
 *
 * Sidebar itemlari:
 *  1. Genel Ayarlar (default) — Bildirimler, Tarayici Araclari, Veri Yonetimi
 *  2. Guvendigim Baglantilar — click'te whitelist.html'e yonlendirir
 *     (kendine ait icerik yok; whitelist.html tam ozellikli — arama +
 *      pagination + input disabled state — burada duplike etmiyoruz)
 *
 * Ilham: referans uzantinin (Blocking settings / Statistics / Whitelisted
 * sites) sol sidebar disiplini. Kullanici alistigi patternle karsilasir.
 */
export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [cleared, setCleared] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDisableNotif, setShowDisableNotif] = useState(false);
  const [activeSection, setActiveSection] = useState<OptionsSection>("general");

  // Responsive: dar ekranlarda (mobile/tablet) sidebar'i uste alip
  // main'i altina koyariz. matchMedia dinlenir; pencere yeniden
  // boyutlandiginca layout anlik degisir.
  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Bilgilendirme sekmesi icin koruma suresi hooku.
  const protectedDays = useProtectedDays();
  // "Alparslan" master toggle — eskiden Header'in sag ust kosesindeydi;
  // artik Genel Ayarlar'in en ustunde. chrome.storage.sync uzerinden
  // popup ile senkron olur ("enabled" key).
  const [enabled, setEnabled] = useState<boolean>(true);
  useEffect(() => {
    chrome.storage.sync.get(["enabled"], (result) => {
      if (typeof result.enabled === "boolean") setEnabled(result.enabled);
    });
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === "sync" && "enabled" in changes && typeof changes.enabled.newValue === "boolean") {
        setEnabled(changes.enabled.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.sync.set({ enabled: next });
    chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled: next });
  };

  useEffect(() => {
    chrome.storage.sync.get(["settings"], (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(result.settings as ExtensionSettings) });
      }
    });
  }, []);

  const saveSettings = useCallback((updated: ExtensionSettings) => {
    setSettings(updated);
    chrome.storage.sync.set({ settings: updated }, () => {
      chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updated });
    });
  }, []);

  // Mirrors the popup "Tehlike Uyarıları" toggle: both control `showDomWarnings`
  // so flipping one reflects in the other. Turning it OFF asks for confirmation.
  const handleNotificationsToggle = () => {
    if (settings.showDomWarnings !== false) {
      setShowDisableNotif(true); // currently ON → confirm before disabling
    } else {
      saveSettings({ ...settings, showDomWarnings: true }); // currently OFF → enable
    }
  };

  const handleClearData = () => {
    chrome.storage.sync.clear(() => {
      // Also clear chrome.storage.local — that's where the breach-banner
      // "bir daha gösterme" dismissed-domains list lives, plus tarama
      // history and any other locally-cached state. Without this, users
      // expect a full reset but the dismissed banners stay silenced.
      chrome.storage.local.remove(["alparslan-breach-dismissed-domains", "history"], () => {
        setSettings(DEFAULT_SETTINGS);
        setCleared(true);
        setTimeout(() => setCleared(false), 2000);
      });
    });
  };


  return (
    <div
      style={{
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      {/* SOL SIDEBAR — 260px sabit genislik, beyaz zemin, sag kenarda
          ince gri hairline. Dar ekranlarda ustte tam genislik, alt kenarda
          hairline. */}
      <aside
        style={{
          width: isNarrow ? "100%" : 260,
          flexShrink: 0,
          background: "white",
          borderRight: isNarrow ? "none" : "1px solid #e2e8f0",
          borderBottom: isNarrow ? "1px solid #e2e8f0" : "none",
          padding: isNarrow ? "16px 12px" : "24px 12px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "0 12px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderBottom: "1px solid #f1f5f9",
            marginBottom: 14,
          }}
        >
          <img
            src="/icons/alparslan_logo.svg"
            alt=""
            width={68}
            height={68}
            style={{
              width: 68,
              height: 68,
              imageRendering: "-webkit-optimize-contrast" as const,
            }}
          />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#172554", letterSpacing: 0.3 }}>Alparslan</div>
            <div style={{ fontSize: 15, color: "#94a3b8", marginTop: 4 }}>{t.options.title}</div>
          </div>
        </div>

        <SidebarNavItem
          label="Genel Ayarlar"
          active={activeSection === "general"}
          onClick={() => setActiveSection("general")}
        />
        <SidebarNavItem
          label="Güvendiğim Bağlantılar"
          active={activeSection === "whitelist"}
          onClick={() => setActiveSection("whitelist")}
        />
        <SidebarNavItem
          label="Bilgilendirme"
          active={activeSection === "notifications"}
          onClick={() => setActiveSection("notifications")}
        />

        {/* Footer — versiyon numarasi manifest'ten. Saga yaslanir,
            koyu ton — sidebar'in "bitiris" cizgisi olur. */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1px solid #f1f5f9",
            fontSize: 12,
            fontWeight: 700,
            color: "#334155",
            padding: "16px 12px 0",
            letterSpacing: 0.2,
          }}
        >
          Alparslan v{chrome.runtime.getManifest().version}
        </div>
      </aside>

      {/* SAG ICERIK PANELI — activeSection'a gore ya Genel Ayarlar ya
          da Guvendigim Baglantilar goruntulenir. Ayni sayfada view
          degisir; yeni sekme acilmaz. */}
      {/* Bilgilendirme sekmesi geniş grid ile daha çok kart yan yana
          sigsin diye maxWidth kaldirilir; diger sekmelerde (Genel Ayarlar,
          Whitelist) form karti + liste okunabilirligi icin 780 sabit.
          Dar ekranda padding daralir + maxWidth kaldirilir. */}
      <main
        style={{
          flex: 1,
          padding: isNarrow ? "20px 16px" : "32px 40px",
          maxWidth: isNarrow || activeSection === "notifications" ? "none" : 780,
        }}
      >
        {activeSection === "general" ? (
          <>
            <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, color: "#0f172a" }}>
              Genel Ayarlar
            </h1>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>
              {t.options.subtitle}
            </p>

            {/* Master toggle — Alparslan ac/kapat. Eskiden Header'in
                sag ust kosesindeydi, buraya alindi (bildirim sekmelerinden
                oteye Genel Ayarlar'in en ustunde). */}
            <Section title="Alparslan">
              <OptionsSettingCard
                title="Alparslan"
                desc="Alparslan güvenlik korumasını açar veya kapatır."
                enabled={enabled}
                onToggle={toggleEnabled}
              />
            </Section>

            <Section title={t.options.notifications}>
              <OptionsSettingCard
                title={t.settings.dangerWarnings}
                desc={t.settings.dangerWarningsDesc}
                enabled={settings.showDomWarnings !== false}
                onToggle={handleNotificationsToggle}
              />
            </Section>

            <Section title={t.options.personalization}>
              <OptionsSettingCard
                title={t.settings.darkMode}
                desc={t.settings.darkModeDesc}
                enabled={settings.darkMode}
                onToggle={() => saveSettings({ ...settings, darkMode: !settings.darkMode })}
              />
              <OptionsSettingCard
                title={t.settings.speechBubble}
                desc={t.settings.speechBubbleDesc}
                enabled={settings.speechBubbleEnabled !== false}
                onToggle={() =>
                  saveSettings({
                    ...settings,
                    speechBubbleEnabled: !(settings.speechBubbleEnabled !== false),
                  })
                }
              />
            </Section>

            <Section title={t.options.browserTools}>
              <OptionsSettingCard
                title={t.settings.contextMenu}
                desc={t.settings.contextMenuDesc}
                enabled={settings.contextMenuEnabled !== false}
                onToggle={() =>
                  saveSettings({
                    ...settings,
                    contextMenuEnabled: !(settings.contextMenuEnabled !== false),
                  })
                }
              />
            </Section>

            <Section title={t.options.dataManagement}>
              <button
                onClick={() => setShowClearConfirm(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.borderColor = "#fca5a5";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(220, 38, 38, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fecaca";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                style={{
                  padding: "10px 20px",
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                }}
              >
                {t.options.clearAll}
              </button>
              {cleared && (
                <span style={{ marginLeft: 12, fontSize: 13, color: "#166534" }}>
                  {t.options.cleared}
                </span>
              )}
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "8px 0 0" }}>
                {t.options.clearDesc}
              </p>
            </Section>
          </>
        ) : activeSection === "whitelist" ? (
          <WhitelistPanel settings={settings} saveSettings={saveSettings} />
        ) : (
          <BilgilendirmeSection protectedDays={protectedDays} />
        )}
      </main>

      {/* Disable "Tehlike Uyarıları" confirmation */}
      {showDisableNotif && (
        <ConfirmModal
          title={t.confirmDisableNotif.message}
          body={t.confirmDisableNotif.detail}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 280, margin: "0 auto" }}>
            <button
              onClick={() => setShowDisableNotif(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "#1e3a8a",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 5px rgba(30,58,138,0.30)",
                transition: "transform 0.15s ease",
              }}
            >
              {t.confirmDisableNotif.keep}
            </button>
            <button
              onClick={() => {
                saveSettings({ ...settings, showDomWarnings: false });
                setShowDisableNotif(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                color: "#374151",
                fontSize: 10.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "transform 0.15s ease",
              }}
            >
              {t.confirmDisableNotif.disable}
            </button>
          </div>
        </ConfirmModal>
      )}

      {/* Clear-all confirmation modal */}
      {showClearConfirm && (
        <ConfirmModal
          title={t.confirmClearData.message}
          body={t.confirmClearData.detail}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 280, margin: "0 auto" }}>
            <button
              onClick={() => setShowClearConfirm(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "#1e3a8a",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 5px rgba(30,58,138,0.30)",
                transition: "transform 0.15s ease",
              }}
            >
              {t.confirmClearData.cancel}
            </button>
            <button
              onClick={() => {
                handleClearData();
                setShowClearConfirm(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                color: "#374151",
                fontSize: 10.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "transform 0.15s ease",
              }}
            >
              {t.confirmClearData.confirm}
            </button>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

/**
 * Sidebar nav item — referans uzantidaki "Blocking settings ›" gorunumu:
 * aktif iken bold + koyu, sag chevron; pasif iken normal, hover'da hafif
 * gri arka plan.
 */
function SidebarNavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#f1f5f9";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "10px 12px",
        border: "none",
        background: active ? "#f1f5f9" : "transparent",
        color: active ? "#0f172a" : "#475569",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        fontFamily: "inherit",
        textAlign: "left",
        marginBottom: 4,
        transition: "background 0.15s ease",
      }}
    >
      <span>{label}</span>
      {active && <span style={{ color: "#94a3b8", fontSize: 14 }}>{"›"}</span>}
    </button>
  );
}

/**
 * Options sayfasinda ayar karti — kartin tamamı tıklanabilir (sadece
 * toggle değil), toggle'ın etrafında popup ile aynı hover halka
 * efekti (boxShadow + scale). Kullanıcı refleksle herhangi bir yere
 * basabilsin diye yapıldı, popup SettingCard ile UX paritesi sağlıyor.
 *
 * Inline stil — Options sayfasında popup theme.ts CSS class'ları
 * yüklü değil, o yüzden mouseEnter/Leave ile elle yönetiliyor.
 */
function OptionsSettingCard({
  title,
  desc,
  enabled,
  onToggle,
  iconSrc,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  /** Popup SettingCard ile paritede — Alparslan Asistan gibi kartlarda
   *  logo gostermek icin opsiyonel gorsel. */
  iconSrc?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${title}: ${enabled ? "ayar aktif" : "ayar kapali"}`}
      onClick={onToggle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f8fafc";
        e.currentTarget.style.transform = "scale(1.015)";
        const knob = e.currentTarget.querySelector<HTMLDivElement>("[data-toggle-knob]");
        if (knob) knob.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "white";
        e.currentTarget.style.transform = "scale(1)";
        const knob = e.currentTarget.querySelector<HTMLDivElement>("[data-toggle-knob]");
        if (knob) knob.style.transform = "scale(1)";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: "white",
        borderRadius: 12,
        transition: "all 0.18s ease",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
        border: "1px solid #e5e7eb",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        color: "#1f2937",
        marginBottom: 8,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1f2937", display: "flex", alignItems: "center", gap: 8 }}>
          {iconSrc && (
            <img
              src={iconSrc}
              alt=""
              width={22}
              height={22}
              decoding="async"
              loading="eager"
              style={{
                width: 22,
                height: 22,
                objectFit: "contain",
                flexShrink: 0,
                imageRendering: "-webkit-optimize-contrast" as const,
              }}
            />
          )}
          <span>{title}</span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{desc}</div>
      </div>
      <div
        data-toggle-knob
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: enabled ? "#1e3a8a" : "#d1d5db",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s, transform 0.18s ease",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: "white",
            position: "absolute",
            top: 2,
            left: enabled ? 22 : 2,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </button>
  );
}

/**
 * Bilgilendirme kartlarindan biri. Metin 2 satirdan uzunsa altta
 * "Devamini oku" butonu cikar; tiklandiginda tam icerik acilir.
 * Overflow tespiti: useLayoutEffect ile ilk render sonrasi
 * scrollHeight/clientHeight karsilastirmasi. Metin degistiginde de
 * yeniden hesaplanir.
 */
function GlossaryCard({ label, desc }: { label: string; desc: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const textRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // Clamp'li halde clientHeight sinirli, scrollHeight tum icerik.
    // scrollHeight buyukse metin 2 satiri aşiyor demektir.
    setIsOverflow(el.scrollHeight - 1 > el.clientHeight);
  }, [desc]);
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{label}</div>
      <div
        ref={textRef}
        style={{
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.55,
          display: expanded ? "block" : "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}
      >
        {desc}
      </div>
      {isOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            alignSelf: "flex-start",
            marginTop: 2,
            border: "none",
            background: "transparent",
            padding: 0,
            color: "var(--text-muted)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: 0.75,
          }}
        >
          {expanded ? "Daha az göster" : "Devamını oku"}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>{title}</h2>
      {children}
    </div>
  );
}

/**
 * Options > Bilgilendirme sekmesi. Uc alt bolum:
 *  1. Koruma Suresi — kac gundur aktif
 *  2. Kisa Bilgilendirme — kavram sozlugu; tum basliklar TEK ton
 *     (koyu slate). Onceden her kavram farkli renkte vurgulaniyordu,
 *     kullanici "cok vurgu farki" bulup tekliktik istedi.
 *  3. Yenilikler — v0.5.0 degisiklikleri, "Eklenenler / Guncellenenler"
 *     iki kategoride kompakt liste.
 */
function BilgilendirmeSection({ protectedDays }: { protectedDays: number }) {
  return (
    <>
      {/* Ust bilgilendirme kart icinde — Alparslan'in agzindan tek cumle:
          koruma suresi + sayfa tanitimi birlestirildi. Kart altta glossary
          kartlariyla ayni stil (beyaz zemin, ince border, rounded); metin
          yardimci gri, gun sayisi koyu slate + bold vurgu. */}
      <div
        style={{
          display: "inline-block",
          width: "fit-content",
          maxWidth: "100%",
          padding: "14px 18px",
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          margin: "0 0 32px",
          fontSize: 14.5,
          fontWeight: 500,
          color: "#475569",
          lineHeight: 1.65,
        }}
      >
        Ben Alparslan, sizi{" "}
        <strong style={{ fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
          {protectedDays} gündür
        </strong>{" "}
        koruyorum. Bu sayfada nasıl çalıştığımı ve kullandığım kavramları bulabilirsiniz.
      </div>

      <Section title="Kısa Bilgilendirme">
        {/* Grid — 240px altina inince tek sutuna duser; tipik options
            genisliginde 2-3 sutun. Kartlar sade: beyaz zemin, ince border,
            yuvarlak kose. Basliklar TEK ton (koyu slate). */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              key: "howItWorks",
              label: "Alparslan Nasıl Çalışır?",
              desc: "Ziyaret ettiğiniz her sayfayı gerçek zamanlı kontrol eder. Adresi Ulusal Siber Olaylara Müdahale Merkezi'nin tehlikeli adres listesiyle karşılaştırır ve şüpheli desenleri arar; risk varsa uyarı gösterir. Kişisel verilerinize dokunmaz, hiçbir bilgiyi dışarı göndermez." as React.ReactNode,
            },
            {
              key: "day",
              label: "Koruma Süresi",
              desc: "Alparslan'ı ilk kez etkinleştirdiğiniz günden itibaren geçen gün sayısını ifade eder. Koruma aktif kaldığı sürece bu sayı her gün otomatik artar; kaç gündür yanınızda olduğumu gösterir." as React.ReactNode,
            },
            { key: "control",   label: t.notificationCenter.glossary.controlLabel,   desc: t.notificationCenter.glossary.controlDesc as React.ReactNode },
            { key: "threat",    label: t.notificationCenter.glossary.threatLabel,    desc: t.notificationCenter.glossary.threatDesc as React.ReactNode },
            { key: "unknown",   label: t.notificationCenter.glossary.unknownLabel,   desc: t.notificationCenter.glossary.unknownDesc as React.ReactNode },
            {
              key: "suspiciousSigns",
              label: "Şüpheli Adresler",
              desc: "Bir adresin \"şüpheli\" işaretlenmesinin bazı nedenleri: bilinen bir markanın adına benzeyen ama harfleri değiştirilmiş bir alan adı, IP numarasıyla açılan bir site ya da \".tk\", \".ml\" gibi dolandırıcılıkta sık kullanılan nadir uzantılar." as React.ReactNode,
            },
            { key: "whitelist", label: t.notificationCenter.glossary.whitelistLabel, desc: t.notificationCenter.glossary.whitelistDesc as React.ReactNode },
            {
              key: "score",
              label: t.notificationCenter.glossary.scoreLabel,
              desc: (
                <>
                  {t.notificationCenter.glossary.scoreDesc1}
                  <span style={{ whiteSpace: "nowrap" }}>{t.notificationCenter.glossary.scoreRangeGood}</span>
                  {t.notificationCenter.glossary.scoreDesc2}
                  <span style={{ whiteSpace: "nowrap" }}>{t.notificationCenter.glossary.scoreRangeMedium}</span>
                  {t.notificationCenter.glossary.scoreDesc3}
                  <span style={{ whiteSpace: "nowrap" }}>{t.notificationCenter.glossary.scoreRangeBad}</span>
                  {t.notificationCenter.glossary.scoreDesc4}
                </>
              ) as React.ReactNode,
            },
            {
              key: "scoreCalc",
              label: "Skor Nasıl Hesaplanır?",
              desc: "Skor günlük olarak, ziyaret ettiğiniz sitelerin durumuna göre hesaplanır. Güvenli siteler skoru artırır; bilinmeyen ve şüpheli sitelerde skor bir miktar düşer, tehlikeli sitelerle karşılaştığınızda ise skor daha belirgin düşer. Her gün sıfırdan başlar ve gün boyunca gezintinize göre yeniden şekillenir." as React.ReactNode,
            },
            {
              key: "actions",
              label: "Sayfadan Ayrıl / Bu Adrese Güven",
              desc: "Konuşma balonunda çıkan iki seçenektir. \"Sayfadan Ayrıl\" aktif sekmeyi kapatır. \"Bu Adrese Güven\" ise siteyi güvendiğim bağlantılara ekler; bir daha aynı adreste uyarı gelmez." as React.ReactNode,
            },
            {
              key: "contextMenu",
              label: "Sağ Tık Kontrolü",
              desc: "Bir bağlantıya, sayfaya veya seçili bir metne sağ tıkladığınızda çıkan \"Alparslan ile Güvenliği Kontrol Et\" seçeneğidir. Tıkladığınızda adresi anında kontrol eder ve durumu size gösterir." as React.ReactNode,
            },
            {
              key: "warningBanner",
              label: "Uyarı Şeridi",
              desc: "Alparslan'ın tehlikeli veya şüpheli bulduğu sayfalarda, sayfa yüklendiği anda üstte otomatik çıkan renkli bir uyarı bandıdır. Turuncu renk şüpheli, kırmızı renk ise tehlikeli durumu gösterir; popup'ı açmadan sizi anında bilgilendirir." as React.ReactNode,
            },
            {
              key: "assistantMood",
              label: "Asistan Modunda Logo Davranışı",
              desc: "Konuşma balonundaki Alparslan logosu ziyaret ettiğiniz sayfanın durumuna göre canlanır: güvenli sayfada sakin durur ve hafifçe nefes alır; tehlikeli sayfada dikkat çekmek için sağa sola sallanır; şüpheli durumda ince bir titremeyle sizi uyarır; bilinmeyen sayfada ise merakla bakınır. Logoyu fareyle sürüklediğinizde bozuk para gibi 3D dönebilir, bıraktığınızda momentumla yavaşça eski konumuna döner." as React.ReactNode,
            },
          ].map((item) => (
            <GlossaryCard key={item.key} label={item.label} desc={item.desc} />
          ))}
        </div>
      </Section>
    </>
  );
}

/**
 * Guvendigim Baglantilar panosu — sidebar "Guvendigim Baglantilar"
 * item'i secildiginde sag icerikte render edilir. whitelist.html tam
 * ozelliklerinin React portu: normalize ekleme, arama, sayfalama (10 /
 * sayfa), input bos iken Ekle disabled + tooltip, silme.
 *
 * Kaynak: settings.whitelist. Add/remove `saveSettings` uzerinden akar,
 * background'a hem ADD_TO_WHITELIST hem REMOVE_FROM_WHITELIST mesaji
 * gonderilir (URL bar navigasyonu gibi anlik senkron icin).
 */
function WhitelistPanel({
  settings,
  saveSettings,
}: {
  settings: ExtensionSettings;
  saveSettings: (s: ExtensionSettings) => void;
}) {
  const [newDomain, setNewDomain] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(WHITELIST_PAGE_SIZE_OPTIONS[0]);
  const [jumpInput, setJumpInput] = useState<string>("");
  // Autofill chip artik dropdown'daki son 4 aday uzerinden calisiyor —
  // aktif tab'in domain/status'u ayri bir state olarak tutulmuyor. Eski
  // currentDomain / currentStatus state'leri hicbir yerde okunmadigi
  // icin kaldirildi.
  // Autofill chip'in altinda acilan "son ziyaret ettigim SAFE olmayan
  // 4 site" dropdown'i acik mi? currentDomain'e ek olarak son ziyaret
  // gecmisinden bu 4 aday da hizli ekleme icin gosterilir.
  const [autofillDropdownOpen, setAutofillDropdownOpen] = useState<boolean>(false);
  // Dropdown DISINA tikladiginda kendiliginden kapansin — wrapper'i
  // ref'ledigimizde document-level mousedown ile hedef wrapper'in
  // icinde mi degil mi bakariz. Escape klavye tusuyla da kapatilabilir
  // (yaygin dropdown UX konvansiyonu).
  const autofillWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autofillDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (autofillWrapperRef.current && !autofillWrapperRef.current.contains(target)) {
        setAutofillDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAutofillDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [autofillDropdownOpen]);
  const { history } = useScanHistory();
  // Son ziyaret gecmisinden whitelist'e eklenebilir en son 4 farkli
  // domain: SAFE olmayan (SUSPICIOUS/DANGEROUS/UNKNOWN) + zaten
  // whitelist'te olmayan + currentDomain'den farkli.
  // Autofill chip'i besleyen liste: son ziyaret edilen, SAFE olmayan ve
  // henuz whitelist'te olmayan 5 farkli domain. Ana buton kaldirildi
  // (eskiden "current site" tek bir yerdi); artik hepsi dropdown icinde.
  // currentDomain filtresi de kaldirildi — current da SAFE degilse
  // dogal olarak history'de yer alir ve listeye girer.
  const recentUnaddedDomains = (() => {
    const seen = new Set<string>();
    const out: ScanHistoryEntry[] = [];
    const sorted = [...history].sort((a, b) => b.checkedAt - a.checkedAt);
    for (const entry of sorted) {
      if (out.length >= 5) break;
      const host = entry.domain.replace(/^www\./, "");
      if (!host) continue;
      if (seen.has(host)) continue;
      if (settings.whitelist.includes(host)) continue;
      if (entry.level === ThreatLevel.SAFE) continue;
      seen.add(host);
      out.push({ ...entry, domain: host });
    }
    return out;
  })();
  useEffect(() => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const candidates = tabs
        .filter((tab) => tab.url && /^https?:\/\//i.test(tab.url))
        // lastAccessed bazi Chromium surumlerinde undefined; fallback: 0.
        .sort((a, b) => ((b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)));
      const target = candidates[0];
      if (!target?.url) return;
      try {
        const host = new URL(target.url).hostname.replace(/^www\./, "");
        if (!host) return;
        // host degeri simdilik saklanmiyor; ileride tekil aktif-sekme
        // yerine bu bilgiye gore chip'i filtrelersek buraya state
        // eklenecek.
      } catch {
        /* invalid URL — chip gosterme */
      }
    });
  }, []);

  const filtered = settings.whitelist.filter((d) => {
    const term = normalizeWhitelistInput(search) || search.trim().toLowerCase();
    return d.includes(term);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  if (safePage !== currentPage) {
    // Sayfa disi kaldiysa (son sayfada tek item silinince, veya pageSize
    // buyuduyse) otomatik toparla.
    setTimeout(() => setCurrentPage(safePage), 0);
  }
  const startIdx = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const handleAdd = () => {
    const domain = normalizeWhitelistInput(newDomain);
    if (!domain || settings.whitelist.includes(domain)) return;
    // Manuel eklemede o an ki verdict elimizde yok — UNKNOWN kabul ederiz;
    // liste band'inde "Bilinmeyen → Guvenli" olarak gorunur.
    const nextMeta = { ...(settings.whitelistMeta || {}) };
    nextMeta[domain] = { previousLevel: ThreatLevel.UNKNOWN, addedAt: Date.now() };
    saveSettings({
      ...settings,
      whitelist: [...settings.whitelist, domain],
      whitelistMeta: nextMeta,
    });
    chrome.runtime.sendMessage({ type: "ADD_TO_WHITELIST", domain });
    setNewDomain("");
    // Yeni eklenen son sayfaya git
    setCurrentPage(Math.max(1, Math.ceil((filtered.length + 1) / pageSize)));
  };

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      setCurrentPage(n);
      setJumpInput("");
    }
  };

  const handleRemove = (domain: string) => {
    // Meta'dan da temizle — silinen alan geri eklenirse yeni verdict'i alsin.
    const nextMeta = { ...(settings.whitelistMeta || {}) };
    delete nextMeta[domain];
    saveSettings({
      ...settings,
      whitelist: settings.whitelist.filter((d) => d !== domain),
      whitelistMeta: nextMeta,
    });
    chrome.runtime.sendMessage({ type: "REMOVE_FROM_WHITELIST", domain });
  };

  const addDisabled = newDomain.trim().length === 0;

  return (
    <>
      <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, color: "#0f172a" }}>
        Güvendiğim Bağlantılar
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "#334155", lineHeight: 1.6 }}>
        Bu listedeki siteler Alparslan tarafından güvenli olarak kabul edilir.
        Sizin oluşturduğunuz bu özel listede, hangi web sitelerine güvenileceği
        tamamen sizin kararınızdır.
      </p>

      {/* Autofill chip — SADECE geniz sunulacak site varsa gorunur.
          Ana buton kaldirildi (eskiden "current site" tek yerdi); artik
          chip yalniz bir "listeyi ac" chevron + basliktir. Dropdown'da
          son ziyaret edilen SAFE olmayan 5 domain. Yeni davranis:
          current site SAFE olsa bile dropdown gorunur; onemli olan
          gecmiste eklenebilir en az bir sitenin olmasi. */}
      {recentUnaddedDomains.length > 0 && newDomain.trim().length === 0 && (
          <div
            ref={autofillWrapperRef}
            style={{
              display: "inline-flex",
              position: "relative",
              maxWidth: "100%",
              marginBottom: 10,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "visible",
              transition: "border-color 0.15s ease",
            }}
          >
            {/* Baslik da toggle yapiyor — kullanici tum satira tikladiginda
                da dropdown acilir/kapanir. Chevron ile tutarli davranis. */}
            <button
              type="button"
              onClick={() => setAutofillDropdownOpen((v) => !v)}
              aria-expanded={autofillDropdownOpen}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                display: "inline-block",
                border: "none",
                background: "transparent",
                padding: "9px 14px",
                color: "#334155",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: "10px 0 0 10px",
                transition: "background 0.15s ease",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              Otomatik yazdırmak isteyebilecekleriniz
            </button>
            {/* Ince ayrac — baslik ile chevron arasinda gorsel ayrim. */}
            <div
              aria-hidden="true"
              style={{
                width: 1,
                background: "#e5e7eb",
                margin: "6px 0",
                flexShrink: 0,
              }}
            />
            <button
              type="button"
              onClick={() => setAutofillDropdownOpen((v) => !v)}
              title={
                autofillDropdownOpen
                  ? "Listeyi kapat"
                  : "Son ziyaret ettiğiniz eklenmemiş siteleri göster"
              }
              aria-expanded={autofillDropdownOpen}
              aria-label="Son ziyaret listesi"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 10px",
                color: "#64748b",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                borderRadius: "0 10px 10px 0",
                transition: "background 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* Zarif SVG chevron — kapali iken saga (aç), acikken sola
                  (kapat) bakar. Kullaniciya yon degistirerek "aksiyon"
                  bildirir. */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  display: "block",
                  transform: autofillDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {recentUnaddedDomains.length > 0 && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: 0,
                  left: "calc(100% + 8px)",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  gap: 8,
                  zIndex: 5,
                  // Saga dogru slide-in: kart-kart yan yana; container'in
                  // kendisi transparent, her domain kendi karti (beyaz
                  // zemin + ince border + rounded). Anim: translate + scale.
                  transformOrigin: "left center",
                  transform: autofillDropdownOpen ? "translateX(0) scaleX(1)" : "translateX(-12px) scaleX(0.85)",
                  opacity: autofillDropdownOpen ? 1 : 0,
                  visibility: autofillDropdownOpen ? "visible" : "hidden",
                  pointerEvents: autofillDropdownOpen ? "auto" : "none",
                  transition:
                    "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, visibility 0.28s",
                }}
              >
                {recentUnaddedDomains.map((entry) => (
                  <button
                    key={entry.domain}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setNewDomain(entry.domain);
                      setAutofillDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                    style={{
                      background: "white",
                      border: "1px solid #e5e7eb",
                      padding: "9px 12px",
                      color: "#334155",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      borderRadius: 10,
                      boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <span>{entry.domain}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t.options.whitelistPlaceholder}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#94a3b8";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#e5e7eb";
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            background: "white",
            fontFamily: "inherit",
            transition: "border-color 0.15s ease",
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={addDisabled}
          title={addDisabled ? "Öncelikle bir web adresi girmeniz gerekiyor" : undefined}
          onMouseEnter={(e) => {
            if (addDisabled) return;
            e.currentTarget.style.background = "#1e40af";
          }}
          onMouseLeave={(e) => {
            if (addDisabled) return;
            e.currentTarget.style.background = "#1e3a8a";
          }}
          style={{
            border: "none",
            background: addDisabled ? "#cbd5e1" : "#1e3a8a",
            color: addDisabled ? "#64748b" : "white",
            borderRadius: 10,
            padding: "0 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: addDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "background 0.15s ease",
            opacity: addDisabled ? 0.7 : 1,
          }}
        >
          {t.add}
        </button>
      </div>

      {/* Liste karti — arama + baslik + icerik + pagination. Onceden
          alanlar havada uctugu icin liste yokmus gibi hissediliyordu;
          hepsini beyaz kart icine alarak "burada bir liste var"
          disiplini kuruldu. */}
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
        }}
      >
        {/* Baslik satiri — sol: baslik + sayi rozeti, sag: arama input'u.
            Bos listede aramaya gerek yok, sag arama gizlenir. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>Güvendiğim Bağlantılar Listesi</span>
          </h2>

          {settings.whitelist.length > 0 && (
            <input
              type="text"
              value={search}
              placeholder="Listede ara..."
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
              }}
              style={{
                /* DURUM sutunundaki "Bilinmeyen" kelimesinin sol kenariyla
                   hizali baslamasi icin genislik artirildi. Container
                   maxWidth 100% ile mobilde tasmayi engeller. */
                width: 320,
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                background: "#ffffff",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            />
          )}
        </div>

        {/* Header ile liste arasi ayirici — liste satirlari arasindaki
            fade gradient'in aksine solid ve full-width. Yapisal bir
            "bolme cizgisi" gorunumu; satir separator'lerinden farkli
            olarak butun genisligi kaplar. */}
        {settings.whitelist.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: "#94a3b8",
              marginBottom: 10,
              opacity: 0.5,
            }}
          />
        )}

        {/* Liste icerik alani */}
        {settings.whitelist.length === 0 ? (
          <div
            style={{
              padding: "36px 20px",
              textAlign: "center",
              color: "#94a3b8",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px dashed #cbd5e1",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
              Liste henüz boş
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>
              Yukarıdaki kutuya güvendiğiniz web adresini yazın ve Ekle'ye basın.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "24px 20px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 14,
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px dashed #cbd5e1",
            }}
          >
            Aramanızla eşleşen site bulunamadı
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Kolon basligi — uc kolon adi da acikca yazili. Durum bandi
                ekranda ortalanmis dursun diye orta kolon 1fr; boylece
                header hem satir band'iyle hem "SITE / ISLEM" ile ayni
                hizada. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 12,
                padding: "0 10px 6px 8px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              <div style={{ textAlign: "left", paddingLeft: 20 }}>Site</div>
              <div style={{ textAlign: "center" }}>Durum</div>
              <div style={{ textAlign: "right" }}>İşlem</div>
            </div>
            {pageItems.map((domain, idx) => {
              const isLast = idx === pageItems.length - 1;
              const meta = settings.whitelistMeta?.[domain];
              const previousLevel = meta?.previousLevel || ThreatLevel.UNKNOWN;
              // Kullanici sayfa disinda kalanlari da saymayi bekler — o
              // yuzden pagination'a duyarli GLOBAL indeks: (sayfa-1)*n + i + 1
              const globalIndex = (safePage - 1) * pageSize + idx + 1;
              return (
              <div
                key={domain}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 10px 10px 8px",
                  // Alt ayirici — solid cizgi yerine ortada net, iki
                  // kenara dogru transparent'a fade eden gradient.
                  // Full-width solid'in "kutu icinde kutu" hissi olmuyor.
                  backgroundImage: isLast
                    ? "none"
                    : "linear-gradient(to right, transparent 0%, #cbd5e1 20%, #cbd5e1 80%, transparent 100%)",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom",
                  backgroundSize: "100% 1px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {/* Sira numarasi rozet icinde — yuvarlak gri zeminde
                      koyu numara. Cıplak "1" yaziyi domain'in kisaltmasi
                      gibi okumaya sebep oluyordu; badge onu bariz "sira"
                      olarak isaretler. */}
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {globalIndex}
                  </span>
                  {/* Domain artik tiklanabilir link — yeni sekmede aciyor.
                      Hover'da hafif mavi + alt cizgi ile "gidebilir" ipucu.
                      rel="noreferrer noopener" phishing / tabnabbing korumasi. */}
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={domain}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#1e3a8a";
                      e.currentTarget.style.transform = "scale(1.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#334155";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#334155",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      cursor: "pointer",
                      display: "inline-block",
                      transformOrigin: "left center",
                      transition: "color 0.15s ease, transform 0.15s ease",
                    }}
                  >
                    {domain}
                  </a>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <WhitelistStatusBand previousLevel={previousLevel} />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(domain)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fecaca";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fee2e2";
                  }}
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fee2e2",
                    color: "#dc2626",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                    transition: "background 0.15s ease",
                  }}
                >
                  Sil
                </button>
              </div>
              );
            })}
          </div>
        )}

        {/* Pagination — kart icinde. Tek satir, 3 grup ayni hizada:
            SOL: Sayfa basina segmented control
            ORTA: prev / sayfa X-Y / next (kompakt butonlarla)
            SAG: Sayfaya git input + Git butonu
            flex-wrap ile dar ekranda alt alta duser ama genel amac
            uc grup ayni yatay hizada olmasi. */}
        {settings.whitelist.length > 0 && (() => {
          const parsed = parseInt(jumpInput, 10);
          const jumpDisabled =
            jumpInput === "" ||
            !Number.isFinite(parsed) ||
            parsed < 1 ||
            parsed > totalPages;
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid #e2e8f0",
                flexWrap: "wrap",
              }}
            >
              {/* SOL — sayfa basina secici */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>Sayfa başına:</span>
                <div
                  style={{
                    display: "flex",
                    background: "#f1f5f9",
                    borderRadius: 999,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {WHITELIST_PAGE_SIZE_OPTIONS.map((n) => {
                    const active = pageSize === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setPageSize(n);
                          setCurrentPage(1);
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.7)";
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = "transparent";
                        }}
                        style={{
                          minWidth: 32,
                          padding: "4px 10px",
                          border: "none",
                          background: active ? "white" : "transparent",
                          color: active ? "#0f172a" : "#64748b",
                          fontWeight: active ? 700 : 500,
                          fontSize: 12,
                          borderRadius: 999,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          boxShadow: active
                            ? "0 1px 2px rgba(15, 23, 42, 0.08)"
                            : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ORTA — prev / sayfa / next. Kompakt (padding 5x11) — sol
                  ve sag gruplarla ayni yukseklikte kalir. Tek sayfaysa
                  ikisi de disabled, hover'da yardimci tooltip cikar. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PageBtn
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  label="← Önceki"
                  disabledTitle={
                    totalPages === 1
                      ? "Şu anda tek sayfa bulunmaktadır"
                      : "İlk sayfadasınız"
                  }
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                    minWidth: 92,
                    textAlign: "center",
                    background: "#f1f5f9",
                    borderRadius: 999,
                    padding: "5px 12px",
                    letterSpacing: 0.2,
                  }}
                >
                  Sayfa {safePage} / {totalPages}
                </span>
                <PageBtn
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  label="Sonraki →"
                  disabledTitle={
                    totalPages === 1
                      ? "Şu anda tek sayfa bulunmaktadır"
                      : "Son sayfadasınız"
                  }
                />
              </div>

              {/* SAG — sayfaya git input + Git. Placeholder yok, kullanici
                  bos alanla karsilasir; boyle bir "yerinde miyim" hissi
                  vermez. Enter tusu da jumpDisabled degilse tetikler. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>Sayfaya git:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumpInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setJumpInput(v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && !jumpDisabled && handleJump()}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  style={{
                    width: 52,
                    padding: "4px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 12,
                    textAlign: "center",
                    background: "white",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}
                />
                <button
                  type="button"
                  onClick={handleJump}
                  disabled={jumpDisabled}
                  title={
                    jumpDisabled
                      ? totalPages === 1
                        ? "Şu anda tek sayfa bulunmaktadır"
                        : "Geçerli bir sayfa numarası girin"
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (!jumpDisabled) e.currentTarget.style.background = "#1e40af";
                  }}
                  onMouseLeave={(e) => {
                    if (!jumpDisabled) e.currentTarget.style.background = "#1e3a8a";
                  }}
                  style={{
                    padding: "5px 12px",
                    border: "none",
                    background: jumpDisabled ? "#cbd5e1" : "#1e3a8a",
                    color: jumpDisabled ? "#64748b" : "white",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: jumpDisabled ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.15s ease",
                    opacity: jumpDisabled ? 0.7 : 1,
                  }}
                >
                  Git
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}

/**
 * Guvendigim Baglantilar listesinde her satirin ortasinda cikan
 * [Onceki Durum] → [Guvenli] band'i. Kullanicinin listedeki her sitenin
 * hangi durumdan bu listeye tasindigini anlamasi icin gorsel bir ipucu.
 *
 * Renkler btn-*-bg / btn-*-text tokenlarindan gelir, karanlik mod otomatik
 * calisir. Onceki durum bilinmiyorsa (eski v0.4.0 oncesi kayitlar veya
 * kullanicinin manuel ekledigi domain) UNKNOWN olarak gosterilir.
 */
function WhitelistStatusBand({ previousLevel }: { previousLevel: ThreatLevel }) {
  const PILL: Record<ThreatLevel, { label: string; bg: string; text: string; border: string }> = {
    [ThreatLevel.SAFE]:       { label: "Güvenli",    bg: "var(--btn-success-bg)", text: "var(--btn-success-text)", border: "var(--btn-success-border)" },
    [ThreatLevel.DANGEROUS]:  { label: "Tehlikeli",  bg: "var(--btn-danger-bg)",  text: "var(--btn-danger-text)",  border: "var(--btn-danger-border)" },
    [ThreatLevel.SUSPICIOUS]: { label: "Şüpheli",    bg: "var(--btn-warning-bg)", text: "var(--btn-warning-text)", border: "var(--btn-warning-border)" },
    [ThreatLevel.UNKNOWN]:    { label: "Bilinmeyen", bg: "var(--btn-neutral-bg)", text: "var(--btn-neutral-text)", border: "var(--btn-neutral-border)" },
  };
  const prev = PILL[previousLevel];
  const now = PILL[ThreatLevel.SAFE];
  const pillStyle = (info: { bg: string; text: string; border: string }) => ({
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: info.bg,
    color: info.text,
    border: `1px solid ${info.border}`,
    lineHeight: 1.3,
    whiteSpace: "nowrap" as const,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <span style={pillStyle(prev)}>{prev.label}</span>
      <span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>→</span>
      <span style={pillStyle(now)}>{now.label}</span>
    </div>
  );
}

function PageBtn({
  disabled,
  onClick,
  label,
  disabledTitle,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  /** disabled iken hover'da gorunecek native tooltip — kullaniciya
   *  neden butonun aktif olmadigini soyler (ilk/son sayfa, tek sayfa
   *  bulunmaktadir, vs.). */
  disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "#f1f5f9";
        e.currentTarget.style.borderColor = "#94a3b8";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 3px 8px rgba(15, 23, 42, 0.08)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "white";
        e.currentTarget.style.borderColor = "#cbd5e1";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      style={{
        border: "1px solid #cbd5e1",
        background: "white",
        color: "#334155",
        borderRadius: 8,
        padding: "5px 11px",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}
