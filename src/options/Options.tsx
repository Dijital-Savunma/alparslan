import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@/utils/types";
import { normalizeWhitelistInput } from "@/utils/whitelist-normalize";
import { ConfirmModal } from "@/components/ConfirmModal";
import t from "@/i18n/tr";

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [newDomain, setNewDomain] = useState("");
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDisableNotif, setShowDisableNotif] = useState(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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

  const handleAddDomain = () => {
    const domain = normalizeWhitelistInput(newDomain);
    if (!domain || settings.whitelist.includes(domain)) return;
    saveSettings({ ...settings, whitelist: [...settings.whitelist, domain] });
    chrome.runtime.sendMessage({ type: "ADD_TO_WHITELIST", domain });
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    saveSettings({ ...settings, whitelist: settings.whitelist.filter((d) => d !== domain) });
    chrome.runtime.sendMessage({ type: "REMOVE_FROM_WHITELIST", domain });
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
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}>{"\u2699\uFE0F"}</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>{t.options.title}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            {t.options.subtitle}
          </p>
        </div>
      </div>

      {/* Saved notification */}
      {saved && (
        <div
          style={{
            padding: "8px 16px",
            background: "#dcfce7",
            color: "#166534",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {t.options.settingsSaved}
        </div>
      )}

      {/* Notifications */}
      <Section title={t.options.notifications}>
        <OptionsSettingCard
          title={t.settings.dangerWarnings}
          desc={t.settings.dangerWarningsDesc}
          enabled={settings.showDomWarnings !== false}
          onToggle={handleNotificationsToggle}
        />
      </Section>

      {/* Whitelist */}
      <Section title={t.options.whitelist}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          {t.options.whitelistDesc}
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
            placeholder={t.options.whitelistPlaceholder}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = "#93c5fd";
                e.currentTarget.style.background = "#f8fafc";
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.background = "white";
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.background = "white";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              outline: "none",
              background: "white",
              transition: "all 0.15s ease",
            }}
          />
          <button
            onClick={handleAddDomain}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1d4ed8";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 10px rgba(37, 99, 235, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#3b82f6";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            {t.add}
          </button>
        </div>
        {settings.whitelist.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>
            {t.options.whitelistEmpty}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {settings.whitelist.map((domain) => (
              <div
                key={domain}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  background: "white",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              >
                <span style={{ fontSize: 13 }}>{domain}</span>
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "0 4px",
                    fontFamily: "inherit",
                  }}
                >
                  {"\u2715"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Clear Data */}
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

      {/* Footer — surum manifest.json'dan okunur, hardcoded degil. */}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
        {t.footer(chrome.runtime.getManifest().version)}
      </div>

      {/* Disable "Tehlike Uyarıları" confirmation — same dialog as the popup.
          Prominent green "keep protection" button, dim "disable" text link. */}
      {showDisableNotif && (
        <ConfirmModal
          title={t.confirmDisableNotif.message}
          body={t.confirmDisableNotif.detail}
        >
          <button
            onClick={() => setShowDisableNotif(false)}
            style={{
              width: "100%",
              padding: "11px 0",
              background: "#16a34a",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: 10,
            }}
          >
            {t.confirmDisableNotif.keep}
          </button>
          <button
            onClick={() => {
              saveSettings({ ...settings, showDomWarnings: false });
              setShowDisableNotif(false);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#94a3b8";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.transform = "scale(1)";
            }}
            style={{
              width: "100%",
              padding: "10px 0",
              background: "transparent",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              color: "#6b7280",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
            }}
          >
            {t.confirmDisableNotif.disable}
          </button>
        </ConfirmModal>
      )}

      {/* Clear-all confirmation modal — destructive action gated behind an
          explicit confirm. Neutral "cancel" + red "confirm" buttons. */}
      {showClearConfirm && (
        <ConfirmModal
          title={t.confirmClearData.message}
          body={t.confirmClearData.detail}
        >
          {/* Sol = aksiyon (kullanici 'Tum Verileri Temizle' butonuna bilerek
              bastigi icin niyetlenen eylem buradadir — kirmizi dolgu net),
              sag = guvenli iptal (gri, kayitlari tutar). Goz okuma sonunda
              sagda durur; isteyen aksiyona sol-tarafa bilincli yonelir. */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                handleClearData();
                setShowClearConfirm(false);
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "#dc2626",
                border: "none",
                borderRadius: 8,
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.confirmClearData.confirm}
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                color: "#374151",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.confirmClearData.cancel}
            </button>
          </div>
        </ConfirmModal>
      )}

    </div>
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
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
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
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.08)";
        const knob = e.currentTarget.querySelector<HTMLDivElement>("[data-toggle-knob]");
        if (knob) {
          knob.style.transform = "scale(1.08)";
          knob.style.boxShadow = enabled
            ? "0 0 0 4px rgba(34, 197, 94, 0.18), 0 3px 8px rgba(34, 197, 94, 0.25)"
            : "0 0 0 4px rgba(148, 163, 184, 0.20), 0 3px 8px rgba(15, 23, 42, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "white";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.04)";
        const knob = e.currentTarget.querySelector<HTMLDivElement>("[data-toggle-knob]");
        if (knob) {
          knob.style.transform = "scale(1)";
          knob.style.boxShadow = "none";
        }
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
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{desc}</div>
      </div>
      <div
        data-toggle-knob
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: enabled ? "#22c55e" : "#d1d5db",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s, transform 0.18s ease, box-shadow 0.18s ease",
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>{title}</h2>
      {children}
    </div>
  );
}
