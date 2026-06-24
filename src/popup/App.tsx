import { useState, useEffect, useCallback } from "react";
import { type ThreatResult, type ExtensionSettings } from "@/utils/types";
import TabBar, { type TabId } from "./TabBar";
import DashboardTab from "./DashboardTab";
import BreachBadge from "./BreachBadge";
import { normalizeQuickWhitelistDomain, isDomainInWhitelist } from "./whitelist-helpers";
import { useInitProgress, useSmoothPercent } from "./hooks/useInitProgress";
import { useExtensionEnabled } from "./hooks/useExtensionEnabled";
import { useScanHistory } from "./hooks/useScanHistory";
import { useExtensionSettings } from "./hooks/useExtensionSettings";
import { useProtectedDays } from "./hooks/useProtectedDays";
import { NotificationPanel } from "./components/NotificationPanel";
import { SettingsTab } from "./components/SettingsTab";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { DurumSkorCards } from "./components/DurumSkorCards";
import { StatusPanel, useLoadingDots } from "./components/StatusPanel";
import {
  type DynamicNotification,
  NOTIFICATIONS_CACHE_STORAGE_KEY,
  DISMISSED_NOTIFICATION_IDS_STORAGE_KEY,
} from "@/notifications/dynamic-notifications";
import t from "@/i18n/tr";

export type SecurityStatus = "safe" | "dangerous" | "suspicious" | "unknown" | "loading" | "disabled";

// Status panel theme tokens. The `bg` field is a translucent rgba so it
// works as a subtle wash on both light and dark surfaces — the previous
// solid pastels (#f0fdf4 etc.) looked great on white but turned into a
// blown-out fog patch over the dark popup background.
const STATUS_CONFIG: Record<Exclude<SecurityStatus, "loading">, { label: string; color: string; bg: string }> = {
  safe: { label: t.status.safe, color: "#16a34a", bg: "rgba(22, 163, 74, 0.10)" },
  dangerous: { label: t.status.dangerous, color: "#dc2626", bg: "rgba(220, 38, 38, 0.10)" },
  suspicious: { label: t.status.suspicious, color: "#d97706", bg: "rgba(217, 119, 6, 0.10)" },
  unknown: { label: t.status.unknown, color: "var(--text-muted)", bg: "rgba(107, 114, 128, 0.10)" },
  disabled: { label: t.status.disabled, color: "#9ca3af", bg: "rgba(156, 163, 175, 0.10)" },
};

// InitStatus interface'i ve init polling mantigi src/popup/hooks/useInitProgress.ts
// dosyasina tasindi. Bu sayede App.tsx 1300+ satirdan biraz nefes alir, SW
// polling'i backoff'la 300ms-sabit'ten 300ms→5s'e bandinda evrimli hale gelir.

// narrateReason() src/popup/narrateReason.ts'e tasindi.

export default function App() {
  // Init durumu artik useInitProgress hook'unda — backoff'lu polling,
  // session marker okuma, cleanup. Component sadece 2 deger okuyor.
  const { initStatus, initDoneSession } = useInitProgress();
  // Yukleme bari: SW'den gelen tepe yuzde "atlamali" — local olarak
  // hedefe dogru yumusakca yaklastir (1 puan/18ms = saniyede ~55 puan).
  const smoothPercent = useSmoothPercent(initStatus?.percent ?? 0);
  // Eger popup'in goruntu omru icinde SW HIC "not ready" durumda
  // gorunmediyse, gercek anlamda bir yukleme yok demektir — loader'i hic
  // gosterme. Bu, "SW init bitmis ama sessionStart marker'i yazilmadan
  // popup acildi" race'inin yarattigi sahte yukleme animasyonunu engeller.
  const [sawLoading, setSawLoading] = useState(false);
  useEffect(() => {
    if (initStatus && !initStatus.ready) setSawLoading(true);
  }, [initStatus]);
  // "Yukleniyor..." basliginin sonundaki noktalari canli yap — kullanici
  // ekranin donmadigini surekli gormeli. Hook sadece loader gercekten
  // gozukurken interval kurar; aksi halde 400ms interval popup'in tum
  // omru boyunca bos yere calisirdi (mertinkos review).
  const loaderVisible =
    initDoneSession === false &&
    !!initStatus &&
    sawLoading &&
    (!initStatus.ready || smoothPercent < 100);
  const loadingDots = useLoadingDots(loaderVisible);
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<SecurityStatus>("loading");
  // Enabled toggle + storage senkron mantigi useExtensionEnabled hook'unda.
  const { enabled, toggleEnabled } = useExtensionEnabled();
  const [reasons, setReasons] = useState<string[]>([]);
  // Tarama gecmisi (history) yukleme + reaktif senkron mantigi
  // useScanHistory hook'unda. clearLocalHistory hook ustunden gelir.
  const { history } = useScanHistory();
  const [pageReasons, setPageReasons] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  // Settings yukleme + reaktif senkron useExtensionSettings hook'una tasindi.
  const { settings, setSettings, saveSettings } = useExtensionSettings();
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  // Koruma süresi hesabi (gun) useProtectedDays hook'unda.
  const protectedDays = useProtectedDays();
  const [popupWhitelistInput, setPopupWhitelistInput] = useState<string>("");
  const [showDisableConfirm, setShowDisableConfirm] = useState<boolean>(false);
  // Speech-bubble action confirmation gates — both verdicts run through a
  // modal so neither path (close-tab or whitelist-domain) fires on a stray
  // click.
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [showTrustConfirm, setShowTrustConfirm] = useState<boolean>(false);
  // Dinamik bildirim state'i — popup mount'unda chrome.storage.local'dan
  // hem cache'lenmis bildirimler hem kullanicinin kalici dismiss ettigi
  // id'ler okunur. Kullaniciya gosterilecek aktif bildirim = ilk
  // unread olan (cache sirasi = JSON sirasi).
  const [cachedNotifications, setCachedNotifications] = useState<DynamicNotification[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  useEffect(() => {
    chrome.storage.local.get(
      [NOTIFICATIONS_CACHE_STORAGE_KEY, DISMISSED_NOTIFICATION_IDS_STORAGE_KEY],
      (result) => {
        const dismissed = result[DISMISSED_NOTIFICATION_IDS_STORAGE_KEY];
        if (Array.isArray(dismissed)) setDismissedNotificationIds(dismissed as string[]);
        const cached = result[NOTIFICATIONS_CACHE_STORAGE_KEY];
        if (Array.isArray(cached) && cached.length > 0) {
          setCachedNotifications(cached as DynamicNotification[]);
          return;
        }
        // Cache henuz dolmadiysa (SW yeni init, fetch tamamlanmadi),
        // dogrudan bundled lists/notifications.json'i okuyup state'e
        // koy. Boylece kullanici reload sonrasi anlik bildirimi gorur.
        fetch(chrome.runtime.getURL("lists/notifications.json"))
          .then((r) => (r.ok ? r.json() : null))
          .then((feed) => {
            if (feed && Array.isArray(feed.notifications)) {
              setCachedNotifications(feed.notifications as DynamicNotification[]);
              // Storage'a da yaz ki SW fetch'e gerek kalmasin.
              chrome.storage.local.set({
                [NOTIFICATIONS_CACHE_STORAGE_KEY]: feed.notifications,
              });
            }
          })
          .catch(() => {});
      },
    );
  }, []);
  // Bu popup oturumunda "Kapat" tiklananlar — gecici. Popup kapanip
  // yeniden acilinca sifirlanir (useState default empty). Boylece:
  //  - Kapat → bu oturumda zilde badge gitsin ama sonraki popup
  //    acilisinda yine cikar.
  //  - Bir daha gösterme → kalici dismiss (storage), bu oturumda da
  //    gizlemek icin ayni flag setine eklenir.
  const [softClosedIds, setSoftClosedIds] = useState<string[]>([]);
  const currentNotification =
    cachedNotifications.find(
      (n) => !dismissedNotificationIds.includes(n.id) && !softClosedIds.includes(n.id),
    ) || null;
  const hasUnreadUpdate = !!currentNotification;
  const handleDismissChangelog = () => {
    if (!currentNotification) return;
    const updated = [...dismissedNotificationIds, currentNotification.id];
    setDismissedNotificationIds(updated);
    chrome.storage.local.set({ [DISMISSED_NOTIFICATION_IDS_STORAGE_KEY]: updated });
    setSoftClosedIds((prev) => [...prev, currentNotification.id]);
  };
  const handleSoftCloseChangelog = () => {
    if (!currentNotification) return;
    setSoftClosedIds((prev) => [...prev, currentNotification.id]);
  };

  // Toplam okunmamis sayisi — zilde gosterilen badge sayisi. Su an sadece
  // remote changelog'lar bildirim olarak sayilir; kullanici aksiyonlari
  // (Sayfadan Ayril, Bu Adrese Guven, ayar toggle'lari vs.) bildirim
  // merkezine artik dusmuyor.
  const unreadCount = hasUnreadUpdate ? 1 : 0;
  // Durum sekmesindeki Skor-style kart hangi kategori acik (null = hicbiri).
  const [durumSkorFilter, setDurumSkorFilter] = useState<"control" | "threat" | "unknown" | null>(null);
  const handleDurumSkorClick = (filter: "control" | "threat" | "unknown") => {
    setDurumSkorFilter((prev) => (prev === filter ? null : filter));
  };

  // saveSettings useExtensionSettings hook'una tasindi.

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";
      setUrl(currentUrl);

      if (!enabled) {
        setStatus("disabled");
        return;
      }

      if (!currentUrl || currentUrl.startsWith("chrome://") || currentUrl.startsWith("about:")) {
        setStatus("unknown");
        // Tell the background to record this as a "Bilinmeyen" visit so the
        // counter on the stats row matches the status displayed above it.
        // (Background dedupes against the most recent entry to avoid spam
        // when the popup is reopened on the same internal page.)
        if (currentUrl) {
          chrome.runtime.sendMessage({ type: "RECORD_UNKNOWN_VIEW", url: currentUrl });
        }
        return;
      }

      // 1) Cached verdict from THIS Chrome session — instant fill so popup
      //    never flashes "Kontrol ediliyor" when SW was idle/restarted.
      //    storage.session yasam dongusu tarayici acik oldugu surece korunur,
      //    SW restart'ina dayanir, browser kapatildiginda silinir. Kullanici
      //    1 saat ayni sayfada kalsa bile her popup acilisinda anlik verdict
      //    gosterilir.
      const cacheKey = `verdict:${currentUrl}`;
      chrome.storage.session.get([cacheKey], (cache) => {
        const cached = cache[cacheKey];
        if (cached && cached.level) {
          setStatus(cached.level as SecurityStatus);
          setReasons(cached.reasons || []);
          setIsWhitelisted((cached.reasons || []).includes(t.reasons.whitelisted));
        }
      });

      // 2) Fresh check — her zaman calisir, verdict degistiyse state guncellenir.
      chrome.runtime.sendMessage(
        { type: "CHECK_URL", url: currentUrl },
        (response: ThreatResult | null) => {
          if (!response) {
            // Yanit gelmediyse cache'i koru — "unknown"a dusurmek yerine
            // mevcut state'i birak. Sadece hala loading'deysek unknown'a gec.
            setStatus((prev) => prev === "loading" ? "unknown" : prev);
            return;
          }
          const level = response.level.toLowerCase() as SecurityStatus;
          setStatus(level);
          setReasons(response.reasons || []);
          setIsWhitelisted((response.reasons || []).includes(t.reasons.whitelisted));
          // Sonraki popup acilisi anlik gostersin diye session cache'e yaz.
          chrome.storage.session.set({
            [cacheKey]: { level, reasons: response.reasons || [] },
          });
        },
      );

      // Fetch page analysis results
      try {
        const domain = new URL(currentUrl).hostname;
        chrome.runtime.sendMessage(
          { type: "GET_PAGE_ANALYSIS", domain },
          (response: { analysis: { reasons: string[]; score: number } | null } | null) => {
            if (response?.analysis?.reasons?.length) {
              setPageReasons(response.analysis.reasons);
            }
          },
        );
      } catch { /* ignore */ }
    });
  }, [enabled, initStatus?.ready]);

  // handleToggle artik useExtensionEnabled hook'unun expose ettigi
  // toggleEnabled fonksiyonu — alias olarak tutuldu ki diger butonlar
  // ayni isim uzerinden cagirabilsin.
  const handleToggle = toggleEnabled;

  // History yukleme + reaktif senkron useScanHistory hook'una tasindi.

  // Koruma süresi hesabi useProtectedDays hook'una tasindi.

  // Authoritative whitelist check: read settings.whitelist from sync storage
  // and re-check whenever the underlying storage changes (e.g. user added/
  // removed a domain from the options page while popup is open).
  const checkWhitelistMembership = useCallback(() => {
    const domain = normalizeQuickWhitelistDomain(
      (() => {
        try { return new URL(url).hostname; } catch { return ""; }
      })(),
    );
    if (!domain) {
      setIsWhitelisted(false);
      return;
    }
    chrome.storage.sync.get(["settings"], (result) => {
      const settings = result.settings || {};
      const whitelist: string[] = settings.whitelist || [];
      setIsWhitelisted(isDomainInWhitelist(domain, whitelist));
    });
  }, [url]);

  useEffect(() => {
    checkWhitelistMembership();
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      // "enabled" + "settings.enabled" senkronu useExtensionEnabled hook'una
      // tasindi. Burada sadece whitelist uyeligi degisirse yeniden kontrol
      // ediyoruz.
      if ("settings" in changes) {
        checkWhitelistMembership();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [checkWhitelistMembership]);

  // handleToggleHistory / handleStatClick / handleClearHistory eski "Tarama
  // Geçmişi" panelinin handler'lariydi; bu panel Skor sekmesindeki
  // SkorCountButton + SkorFilteredList yapısıyla degistirildi, eski
  // handler'lara artik referans yok, silindi.

  // Closes the active tab from the in-bubble "Sayfayı Kapat" rescue button —
  // used in the suspicious/dangerous/unknown speech-bubble action row.
  const handleClosePage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id;
      if (typeof id === "number") chrome.tabs.remove(id);
    });
  };

  const handleAddToWhitelist = () => {
    const domain = normalizeQuickWhitelistDomain(displayDomain);
    if (!domain || domain === "—") return;
    chrome.storage.sync.get(["settings"], (result) => {
      const current: ExtensionSettings = result.settings || {};
      const list: string[] = current.whitelist || [];
      if (list.includes(domain)) {
        setIsWhitelisted(true);
        return;
      }
      const updated: ExtensionSettings = { ...current, whitelist: [...list, domain] };
      chrome.storage.sync.set({ settings: updated }, () => {
        setIsWhitelisted(true);
        // Update IDB-backed cache used by CHECK_URL.
        chrome.runtime.sendMessage({ type: "ADD_TO_WHITELIST", domain });
        // Propagate settings change so background re-applies (and other
        // popups/options pages refresh their state).
        chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updated });
      });
    });
  };

  const handleViewWhitelist = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("whitelist.html") });
  };

  const handleAddWhitelistEntry = () => {
    const domain = normalizeQuickWhitelistDomain(popupWhitelistInput);
    if (!domain) return;
    chrome.storage.sync.get(["settings"], (result) => {
      const current: ExtensionSettings = result.settings || {};
      const list: string[] = current.whitelist || [];
      if (list.includes(domain)) {
        setPopupWhitelistInput("");
        return;
      }
      const updated: ExtensionSettings = { ...current, whitelist: [...list, domain] };
      chrome.storage.sync.set({ settings: updated }, () => {
        setPopupWhitelistInput("");
        // Local state mirror so the count badge + any other settings-derived
        // UI (e.g. whitelist length checks) reflect the change instantly
        // instead of waiting for the storage.onChanged round-trip.
        setSettings((prev) => prev ? { ...prev, whitelist: updated.whitelist } : updated);
        chrome.runtime.sendMessage({ type: "ADD_TO_WHITELIST", domain });
        chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updated });
      });
    });
  };


  // When the user just whitelisted the current site we want the status panel
  // to flip to "Güvenli" immediately (matches the legacy bundled popup), even
  // though the next CHECK_URL is still in flight. Once that response lands,
  // `status` will already be "safe" so the override becomes a no-op.
  const displayStatus = isWhitelisted && status !== "loading" ? "safe" : status;
  const config = displayStatus === "loading" ? null : STATUS_CONFIG[displayStatus];
  const displayDomain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url || "\u2014";
    }
  })();

  // Loading screen while lists are being loaded — but ONLY on the first cold
  // start of the Chrome session. `initDoneSession === false` means the bar
  // hasn't run yet this session; `null` (still reading the flag) or `true`
  // both suppress it so silent worker restarts don't flash the bar again.
  // Loader'i kapatmadan once smooth bar 100'e ulassin — yoksa "ready"
  // sinyali bir anda gelirse kullanici climb'in son saniyesini hic gormez.
  // Ek olarak `sawLoading` istiyoruz ki SW'yi zaten bitmis durumda
  // yakalarsak hic loader gostermeyelim (sahte climb yok).
  if (loaderVisible && initStatus) {
    return (
      <div style={{ width: 340, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14 }}>
        <div
          style={{
            padding: "12px 16px",
            background: "linear-gradient(135deg, var(--accent-navy), var(--accent-navy-deep))",
            borderBottom: "2px solid var(--accent-info-bright)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src="/icons/alparslan_logo.svg"
            alt="Alparslan"
            width={36}
            height={36}
            decoding="async"
            loading="eager"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              imageRendering: "-webkit-optimize-contrast" as const,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: "#f8fafc" }}>Alparslan</span>
        </div>
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          {/* Sonundaki "..." statik degil, canli — kullanici "ekran dondu mu"
              diye dusunmesin diye 400ms turda nokta beliriyor / kayboluyor.
              Noktalar sabit-genislik bir span'de durur (min-width: 18px,
              left-aligned), boylece cumle merkez disiplinini bozup
              titreyerek saga sola kaymaz. */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>
            {initStatus.step.replace(/\.+$/, "")}
            <span style={{ display: "inline-block", width: 18, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
              {loadingDots}
            </span>
          </div>
          {/* Progress bar — width animasyonu artik smoothPercent tarafindan
              tikatik yapildigi icin CSS transition'a gerek yok (yoksa cift
              animasyon olusur). */}
          <div style={{ height: 6, borderRadius: 3, background: "var(--ring-track)", overflow: "hidden", marginBottom: 12 }}>
            <div
              style={{
                height: "100%",
                width: smoothPercent + "%",
                background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                borderRadius: 3,
                transition: "width 0.05s linear",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16, fontVariantNumeric: "tabular-nums" }}>
            %{smoothPercent}
          </div>
          {/* Step checklist \u2014 ilk pending step ("o anda yuklenen") loadingPulse
              animasyonu ile nefes alir, kullanici hangi adimin o an aktif
              oldugunu net gorur. Sirasi geleli olmayan adimlar sakin gri. */}
          <div style={{ textAlign: "left", display: "inline-block" }}>
            {(() => {
              const firstPendingIdx = initStatus.steps.findIndex((x) => !x.done);
              return initStatus.steps.map((s, i) => {
                const isCurrent = i === firstPendingIdx;
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      color: s.done ? "#16a34a" : isCurrent ? "#2563eb" : "#9ca3af",
                      padding: "2px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 14,
                        height: 14,
                        animation: isCurrent ? "loadingPulse 1.1s ease-in-out infinite" : "none",
                      }}
                    >
                      {s.done ? "\u2713" : "\u25CB"}
                    </span>
                    <span>{s.name}</span>
                    {s.done && s.ms !== undefined && (
                      <span style={{ fontSize: 10, color: "#b0b5bd" }}>{s.ms}ms</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {/* Alt taraftaki kucuk reassurance metni — kullanicinin "ne bekledigim
              belli mi" sorusunu yatistirir, banking/guvenlik uygulamalari
              tarzinda sade ve profesyonel. */}
          <div style={{ marginTop: 20, fontSize: 10.5, color: "#9ca3af", fontStyle: "italic", letterSpacing: 0.2 }}>
            Güvenlik verileri senkronize ediliyor, lütfen bekleyin.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 340, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14 }}>
      {/* Header components/Header.tsx'e tasindi */}
      <Header
        enabled={enabled}
        onToggleEnabled={handleToggle}
        notificationsOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)}
        unreadCount={unreadCount}
      />

      {notificationsOpen && (
        <NotificationPanel
          onClose={() => setNotificationsOpen(false)}
          notification={hasUnreadUpdate ? currentNotification : null}
          onDismissNotification={handleDismissChangelog}
          onSoftCloseNotification={handleSoftCloseChangelog}
          protectedDays={protectedDays}
        />
      )}

      {!notificationsOpen && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}

      {!notificationsOpen && (
      <>
      {activeTab === "dashboard" ? (
        <DashboardTab />
      ) : activeTab === "settings" ? (
        settings ? (
          <SettingsTab
            settings={settings}
            saveSettings={saveSettings}
            setShowDisableConfirm={setShowDisableConfirm}
            displayDomain={displayDomain}
            displayStatus={displayStatus}
            popupWhitelistInput={popupWhitelistInput}
            setPopupWhitelistInput={setPopupWhitelistInput}
            handleAddWhitelistEntry={handleAddWhitelistEntry}
            handleViewWhitelist={handleViewWhitelist}
          />
        ) : null
      ) : (
      <>
      {/* Status panel components/StatusPanel.tsx'e tasindi */}
      <StatusPanel
        config={config}
        displayStatus={displayStatus}
        displayDomain={displayDomain}
        settings={settings}
        reasons={reasons}
        pageReasons={pageReasons}
        isWhitelisted={isWhitelisted}
        popupWhitelistInput={popupWhitelistInput}
        setPopupWhitelistInput={setPopupWhitelistInput}
        setShowCloseConfirm={setShowCloseConfirm}
        setShowTrustConfirm={setShowTrustConfirm}
        enabled={enabled}
      />

      <BreachBadge domain={displayDomain} />

      <DurumSkorCards
        history={history}
        durumSkorFilter={durumSkorFilter}
        onSkorClick={handleDurumSkorClick}
      />

      </>
      )}
      </>
      )}

      {!notificationsOpen && <Footer />}

      {/* Confirmation modal shown when the user tries to turn OFF danger
          warnings. UX: "keep protecting" is a big bright-green button; the
          "disable" action is a plain, dim text link so a careless tap can't
          easily switch protection off. */}
      {showDisableConfirm && settings && (
        <ConfirmModal
          title={t.confirmDisableNotif.message}
          body={t.confirmDisableNotif.detail}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 240, margin: "0 auto" }}>
            <button
              onClick={() => setShowDisableConfirm(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "var(--accent-navy)",
                color: "white",
                border: "none",
                borderRadius: 6,
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
                setShowDisableConfirm(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "transparent",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                color: "var(--text-muted)",
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

      {/* "Sayfadan Ayrıl" confirmation — closing the dangerous tab IS the safe
          move here. "Sekmeyi Kapat" is filled green (success accent) so the eye
          lands on the safe choice as inviting / calming, not aggressive blue.
          "Vazgeç" stays transparent so a reflex tap on it leaves the user
          back on the warning, not still on the page. */}
      {showCloseConfirm && (
        <ConfirmModal
          title={t.speechBubble.confirmCloseTitle}
          body={t.speechBubble.confirmCloseBody}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 240, margin: "0 auto" }}>
            <button
              onClick={() => {
                setShowCloseConfirm(false);
                handleClosePage();
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "var(--accent-danger)",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 5px rgba(220,38,38,0.30)",
                transition: "transform 0.15s ease",
              }}
            >
              {t.speechBubble.confirmCloseConfirm}
            </button>
            <button
              onClick={() => setShowCloseConfirm(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "transform 0.15s ease",
              }}
            >
              {t.speechBubble.confirmCloseCancel}
            </button>
          </div>
        </ConfirmModal>
      )}

      {/* "Bu Adrese Güven" confirmation — staying away IS the safe move here.
          Tüm modal'larda tek standart: SOL = Vazgeç (escape), SAG = ana eylem.
          Renk neyin güvenli/varsayilan oldugunu soyler: riskli modal'larda
          (trust, clear, disable) yesil dolgu Vazgeç'te (sol), beyaz outline
          riskli eylemde (sag) — refleks tik korumayi korur. */}
      {showTrustConfirm && (
        <ConfirmModal
          title={t.speechBubble.confirmTrustTitle}
          body={t.speechBubble.confirmTrustBody}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 240, margin: "0 auto" }}>
            <button
              onClick={() => setShowTrustConfirm(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "var(--accent-navy)",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 5px rgba(30,58,138,0.30)",
                transition: "transform 0.15s ease",
              }}
            >
              {t.speechBubble.confirmTrustCancel}
            </button>
            <button
              onClick={() => {
                setShowTrustConfirm(false);
                handleAddToWhitelist();
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "transform 0.15s ease",
              }}
            >
              {t.speechBubble.confirmTrustConfirm}
            </button>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
