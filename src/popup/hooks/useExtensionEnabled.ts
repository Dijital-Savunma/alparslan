import { useEffect, useState, useCallback } from "react";

/**
 * Alparslan eklentisinin "Aktif/Pasif" toggle durumunu yonetir.
 *
 * Sorumluluklar:
 *  - Mount'ta chrome.storage.sync.enabled'i okur (kalici durum geri yuklenir).
 *  - chrome.storage.onChanged listener'i ile diger sekmeler / arka plan /
 *    intro ekrani toggle'i degistirirse popup anlik senkron olur.
 *  - toggleEnabled(): hem local state'i hem background'i (SET_ENABLED mesaji
 *    + chrome.storage.sync) bir arada gunceller.
 *
 * Geri donulen:
 *  - enabled: anlik degeri (default true)
 *  - toggleEnabled: aktif/pasif yapan setter
 *  - setEnabled: nadir durumlar icin local-only setter (intro ekrani vb.
 *    yer disinda direkt cagrilmamali)
 */
export function useExtensionEnabled(): {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggleEnabled: (v: boolean) => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(true);

  // Mount'ta kalici durumu oku.
  useEffect(() => {
    chrome.storage.sync.get("enabled", (result) => {
      if (typeof result.enabled === "boolean") setEnabledState(result.enabled);
    });
  }, []);

  // Diger pencereler / arka plan toggle'i degistirirse anlik senkron ol.
  // Hem ust seviye "enabled" anahtarini hem de legacy "settings.enabled"
  // alanini dinler (eski paketlenmis popup ikisini birden yaziyordu).
  useEffect(() => {
    const onChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      if ("enabled" in changes && typeof changes.enabled.newValue === "boolean") {
        setEnabledState(changes.enabled.newValue);
        return;
      }
      if ("settings" in changes) {
        const settings = changes.settings.newValue as { enabled?: boolean } | undefined;
        if (settings && typeof settings.enabled === "boolean") {
          setEnabledState(settings.enabled);
        }
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const toggleEnabled = useCallback((newEnabled: boolean) => {
    setEnabledState(newEnabled);
    chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled: newEnabled });
  }, []);

  return { enabled, setEnabled: setEnabledState, toggleEnabled };
}
