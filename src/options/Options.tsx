import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@/utils/types";

type ProtectionLevel = ExtensionSettings["protectionLevel"];

const PROTECTION_LABELS: Record<ProtectionLevel, { label: string; desc: string }> = {
  low: { label: "Dusuk", desc: "Sadece bilinen tehlikeli siteleri engeller" },
  medium: { label: "Orta", desc: "Tehlikeli siteler + suppheli URL tespiti" },
  high: { label: "Yuksek", desc: "Tum kontroller aktif, agresif koruma" },
};

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [newDomain, setNewDomain] = useState("");
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);

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

  const handleProtectionChange = (level: ProtectionLevel) => {
    saveSettings({ ...settings, protectionLevel: level });
  };

  const handleNotificationsToggle = () => {
    saveSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled });
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain || settings.whitelist.includes(domain)) return;
    saveSettings({ ...settings, whitelist: [...settings.whitelist, domain] });
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    saveSettings({ ...settings, whitelist: settings.whitelist.filter((d) => d !== domain) });
  };

  const handleClearData = () => {
    chrome.storage.sync.clear(() => {
      setSettings(DEFAULT_SETTINGS);
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}>{"\uD83D\uDEE1\uFE0F"}</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>Alparslan Ayarlar</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Guvenlik ve gizlilik tercihlerinizi yonetin
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
          Ayarlar kaydedildi
        </div>
      )}

      {/* Protection Level */}
      <Section title="Koruma Seviyesi">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(Object.keys(PROTECTION_LABELS) as ProtectionLevel[]).map((level) => (
            <label
              key={level}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                border: `2px solid ${settings.protectionLevel === level ? "#3b82f6" : "#e5e7eb"}`,
                borderRadius: 8,
                cursor: "pointer",
                background: settings.protectionLevel === level ? "#eff6ff" : "white",
              }}
            >
              <input
                type="radio"
                name="protection"
                checked={settings.protectionLevel === level}
                onChange={() => handleProtectionChange(level)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{PROTECTION_LABELS[level].label}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {PROTECTION_LABELS[level].desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Bildirimler">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "white",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Tehdit Bildirimleri</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              Tehlikeli site tespit edildiginde bildirim goster
            </div>
          </div>
          <div
            onClick={handleNotificationsToggle}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: settings.notificationsEnabled ? "#22c55e" : "#d1d5db",
              position: "relative",
              transition: "background 0.2s",
              cursor: "pointer",
              flexShrink: 0,
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
                left: settings.notificationsEnabled ? 22 : 2,
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        </label>
      </Section>

      {/* Whitelist */}
      <Section title="Beyaz Liste">
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          Bu listedeki siteler icin koruma devredisi birakilir
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
            placeholder="ornek: example.com"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleAddDomain}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            Ekle
          </button>
        </div>
        {settings.whitelist.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>
            Beyaz liste bos
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
      <Section title="Veri Yonetimi">
        <button
          onClick={handleClearData}
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
          }}
        >
          Tum Verileri Temizle
        </button>
        {cleared && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#166534" }}>
            Veriler temizlendi
          </span>
        )}
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "8px 0 0" }}>
          Tum ayarlar ve beyaz liste sifirlanir
        </p>
      </Section>

      {/* Footer */}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
        Alparslan v0.1.0 — Dijital Savunma
      </div>
    </div>
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
