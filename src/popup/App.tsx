import { useState, useEffect, useCallback } from "react";
import { type ThreatResult, type ExtensionStats, type ExtensionSettings } from "@/utils/types";
import TabBar, { type TabId } from "./TabBar";
import DashboardTab from "./DashboardTab";
import BreachBadge from "./BreachBadge";
import { normalizeQuickWhitelistDomain, isDomainInWhitelist } from "./whitelist-helpers";
import { useInitProgress } from "./hooks/useInitProgress";
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
import { StatusPanel } from "./components/StatusPanel";
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

const STATUS_ICONS: Record<Exclude<SecurityStatus, "loading">, string> = {
  safe: "\u2705",
  dangerous: "\uD83D\uDED1",
  suspicious: "\u26A0\uFE0F",
  unknown: "\u2753",
  disabled: "\u23F8\uFE0F",
};

// InitStatus interface'i ve init polling mantigi src/popup/hooks/useInitProgress.ts
// dosyasina tasindi. Bu sayede App.tsx 1300+ satirdan biraz nefes alir, SW
// polling'i backoff'la 300ms-sabit'ten 300ms→5s'e bandinda evrimli hale gelir.

// narrateReason() src/popup/narrateReason.ts'e tasindi.

export default function App() {
  // Init durumu artik useInitProgress hook'unda — backoff'lu polling,
  // session marker okuma, cleanup. Component sadece 2 deger okuyor.
  const { initStatus, initDoneSession } = useInitProgress();
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<SecurityStatus>("loading");
  // Enabled toggle + storage senkron mantigi useExtensionEnabled hook'unda.
  const { enabled, toggleEnabled } = useExtensionEnabled();
  const [reasons, setReasons] = useState<string[]>([]);
  const [stats, setStats] = useState<ExtensionStats>({ urlsChecked: 0, threatsBlocked: 0, trackersBlocked: 0 });
  // Tarama gecmisi (history) yukleme + reaktif senkron mantigi
  // useScanHistory hook'unda. clearLocalHistory hook ustunden gelir.
  const { history } = useScanHistory();
  const [pageReasons, setPageReasons] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  // Settings yukleme + reaktif senkron useExtensionSettings hook'una tasindi.
  const { settings, setSettings, saveSettings } = useExtensionSettings();
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  // Koruma süresi hesabi (gun) useProtectedDays hook'unda.
  const protectedDays = useProtectedDays();
  const [popupWhitelistInput, setPopupWhitelistInput] = useState<string>("");
  const [showDisableConfirm, setShowDisableConfirm] = useState<boolean>(false);
  // Speech-bubble action confirmation gates — both verdicts run through a
  // modal so neither path (close-tab or whitelist-domain) fires on a stray
  // click.
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [showTrustConfirm, setShowTrustConfirm] = useState<boolean>(false);
  // Durum sekmesindeki Skor-style kart hangi kategori acik (null = hicbiri).
  const [durumSkorFilter, setDurumSkorFilter] = useState<"control" | "threat" | "unknown" | null>(null);
  const handleDurumSkorClick = (filter: "control" | "threat" | "unknown") => {
    setDurumSkorFilter((prev) => (prev === filter ? null : filter));
  };

  // saveSettings useExtensionSettings hook'una tasindi.

  // Fetch popup stats — re-runs when init becomes ready.
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response: { stats: ExtensionStats } | null) => {
      if (response?.stats) setStats(response.stats);
    });
  }, [initStatus?.ready]);

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

      chrome.runtime.sendMessage(
        { type: "CHECK_URL", url: currentUrl },
        (response: ThreatResult | null) => {
          if (!response) {
            setStatus("unknown");
            return;
          }
          setStatus(response.level.toLowerCase() as SecurityStatus);
          setReasons(response.reasons || []);
          setIsWhitelisted((response.reasons || []).includes(t.reasons.whitelisted));
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
  if (initDoneSession === false && initStatus && !initStatus.ready) {
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
          <img src="/icons/alparslan_logo.svg" alt="Alparslan" style={{ width: 36, height: 36, borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: "#f8fafc" }}>Alparslan</span>
        </div>
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>
            {initStatus.step}
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: "var(--ring-track)", overflow: "hidden", marginBottom: 12 }}>
            <div
              style={{
                height: "100%",
                width: initStatus.percent + "%",
                background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
            %{initStatus.percent}
          </div>
          {/* Step checklist */}
          <div style={{ textAlign: "left", display: "inline-block" }}>
            {initStatus.steps.map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: s.done ? "#16a34a" : "#9ca3af", padding: "2px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{s.done ? "\u2713" : "\u25CB"}</span>
                <span>{s.name}</span>
                {s.done && s.ms !== undefined && (
                  <span style={{ fontSize: 10, color: "#b0b5bd" }}>{s.ms}ms</span>
                )}
              </div>
            ))}
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
      />

      {notificationsOpen && (
        <NotificationPanel
          infoOpen={infoOpen}
          setInfoOpen={setInfoOpen}
          controlCount={history.length}
          threatCount={history.filter((h) => h.level === "DANGEROUS" || h.level === "SUSPICIOUS").length}
          unknownCount={history.filter((h) => h.level === "UNKNOWN").length}
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
        handleAddToWhitelist={handleAddToWhitelist}
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
          <button
            onClick={() => setShowDisableConfirm(false)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            style={{
              width: "100%",
              padding: "11px 0",
              background: "var(--accent-success)",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: 8,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
              transition: "transform 0.15s ease",
            }}
          >
            🟢 {t.confirmDisableNotif.keep}
          </button>
          <button
            onClick={() => {
              saveSettings({ ...settings, showDomWarnings: false });
              setShowDisableConfirm(false);
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            style={{
              width: "100%",
              padding: "6px 0",
              background: "transparent",
              border: "none",
              color: "var(--text-faint)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "transform 0.15s ease",
            }}
          >
            {t.confirmDisableNotif.disable}
          </button>
        </ConfirmModal>
      )}

      {/* "Sayfadan Ayrıl" confirmation — closing the dangerous tab IS the safe
          move here, so the filled "Sekmeyi Kapat" button is dominant. "Vazgeç"
          stays transparent so a reflex tap on it leaves the user back on the
          warning, not still on the page. */}
      {showCloseConfirm && (
        <ConfirmModal
          title={t.speechBubble.confirmCloseTitle}
          body={t.speechBubble.confirmCloseBody}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setShowCloseConfirm(false);
                handleClosePage();
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "9px 8px",
                background: "var(--accent-info)",
                color: "white",
                border: "none",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
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
                padding: "9px 8px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border-strong)",
                borderRadius: 9,
                fontSize: 12,
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

      {/* "Bu Adrese Güven" confirmation — staying away IS the safe move here,
          so "Vazgeç" is the dominant filled-gray button (easy reflex tap).
          "Evet, Güven" is the subtle outlined button with a faint amber tint
          so the user has to deliberately aim at it to take the risk. */}
      {showTrustConfirm && (
        <ConfirmModal
          title={t.speechBubble.confirmTrustTitle}
          body={t.speechBubble.confirmTrustBody}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowTrustConfirm(false)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                flex: 1,
                padding: "9px 8px",
                background: "#475569",
                color: "white",
                border: "none",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 3px 8px rgba(71,85,105,0.30)",
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
                padding: "9px 8px",
                background: "transparent",
                color: "var(--accent-warning)",
                border: "1px solid #fcd34d",
                borderRadius: 9,
                fontSize: 12,
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
