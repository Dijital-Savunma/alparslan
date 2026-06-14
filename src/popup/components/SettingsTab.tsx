import { type ExtensionSettings } from "@/utils/types";
import t from "@/i18n/tr";
import { SettingCard } from "./SettingCard";
import { type SecurityStatus } from "../App";

/**
 * Ayarlar sekmesinin (popup'in 3. tab'i) tüm JSX'i. Stateless: hook'lardan
 * gelen settings/saveSettings ve App.tsx'teki whitelist handler'ları
 * props olarak alır.
 *
 * Içerik:
 *  - 3 ayar kartı (Tehlike Uyarıları, Karanlık Mod, Alparslan Asistan)
 *  - Güvendiğim Bağlantılar bölümü (autofill chip + ekle butonu + görüntüle)
 *  - "Tüm Ayarlar" linki (options.html'i açar)
 *
 * Detaylı Güvenlik Taraması kartı popup'tan kaldırıldı (sadece Tüm
 * Ayarlar sayfasında); Skor sekmesindeki Skor Analizi panosu hala
 * settings.networkMonitoringEnabled'i okur.
 */
export function SettingsTab({
  settings,
  saveSettings,
  setShowDisableConfirm,
  displayDomain,
  displayStatus,
  popupWhitelistInput,
  setPopupWhitelistInput,
  handleAddWhitelistEntry,
  handleViewWhitelist,
}: {
  settings: ExtensionSettings;
  saveSettings: (s: ExtensionSettings) => void;
  setShowDisableConfirm: (v: boolean) => void;
  displayDomain: string;
  displayStatus: SecurityStatus;
  popupWhitelistInput: string;
  setPopupWhitelistInput: (v: string) => void;
  handleAddWhitelistEntry: () => void;
  handleViewWhitelist: () => void;
}) {
  return (
    <div style={{ padding: "12px 16px" }}>
      <SettingCard
        title={t.settings.dangerWarnings}
        desc={t.settings.dangerWarningsDesc}
        enabled={settings.showDomWarnings !== false}
        onToggle={() => {
          if (settings.showDomWarnings !== false) {
            setShowDisableConfirm(true);
          } else {
            saveSettings({ ...settings, showDomWarnings: true });
          }
        }}
      />

      <SettingCard
        title={t.settings.darkMode}
        desc={t.settings.darkModeDesc}
        enabled={settings.darkMode}
        onToggle={() => saveSettings({ ...settings, darkMode: !settings.darkMode })}
      />

      <SettingCard
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

      {/* Güvendiğim Bağlantılar — popup üzerinden hızlı whitelist yönetimi */}
      <div
        style={{
          marginBottom: 14,
          padding: 12,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              fontSize: 13,
              color: "var(--text)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--accent-success)",
                color: "white",
                fontSize: 10,
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(22, 163, 74, 0.35)",
              }}
            >
              ✓
            </span>
            {t.options.whitelist}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Bu listedeki siteler güvenli kabul edilir
          </div>
        </div>

        {/* "Mevcut siteyi otomatik yazdır" autofill chip — mor tonla
            navigationdan ayrıldı. */}
        {displayDomain &&
          displayDomain !== "—" &&
          displayStatus !== "safe" &&
          displayStatus !== "loading" &&
          displayStatus !== "disabled" && (
            <button
              onClick={() => setPopupWhitelistInput(displayDomain)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.16)";
                e.currentTarget.style.borderColor = "#7c3aed";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.09)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.45)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                marginBottom: 6,
                background: "rgba(139, 92, 246, 0.09)",
                border: "1px solid rgba(139, 92, 246, 0.45)",
                color: "#6d28d9",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                borderRadius: 7,
                transition: "all 0.15s ease",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(139, 92, 246, 0.12)",
              }}
            >
              {t.popupWhitelist.autoFillCurrent(displayDomain)}
            </button>
          )}

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            value={popupWhitelistInput}
            placeholder={t.options.whitelistPlaceholder}
            onChange={(e) => setPopupWhitelistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddWhitelistEntry();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "8px 9px",
              border: "1px solid var(--border-strong)",
              borderRadius: 9,
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit",
              color: "var(--text)",
              background: "var(--surface-card)",
            }}
          />
          <button
            onClick={handleAddWhitelistEntry}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-info-deep)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-info)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            style={{
              border: "none",
              background: "var(--accent-info)",
              color: "white",
              borderRadius: 9,
              padding: "8px 11px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            {t.add}
          </button>
        </div>

        <button
          onClick={handleViewWhitelist}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e0e7ff";
            e.currentTarget.style.color = "var(--accent-navy)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#eef2ff";
            e.currentTarget.style.color = "var(--accent-info)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "8px 10px",
            border: "1px solid #bfdbfe",
            background: "#eef2ff",
            color: "var(--accent-info)",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s ease",
          }}
        >
          {t.popupWhitelist.viewAll}
          <span
            style={{
              marginLeft: 7,
              padding: "1px 7px",
              background: "rgba(107, 114, 128, 0.18)",
              color: "var(--text-muted)",
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 600,
              verticalAlign: "middle",
            }}
          >
            {settings?.whitelist?.length ?? 0}
          </span>
        </button>
      </div>

      {/* "Tüm Ayarlar" linki — options.html'i açar */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#d1d5db";
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#e5e7eb";
          e.currentTarget.style.transform = "scale(1)";
        }}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "#e5e7eb",
          border: "1px solid #d1d5db",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 12,
          color: "#374151",
          fontFamily: "inherit",
          marginTop: 4,
          transition: "all 0.2s ease",
        }}
      >
        ⚙️ {t.settings.allSettings}
      </button>
    </div>
  );
}
