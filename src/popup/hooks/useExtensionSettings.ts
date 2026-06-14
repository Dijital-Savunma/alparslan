import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { type ExtensionSettings } from "@/utils/types";

/**
 * Alparslan'in ayarlarini (network monitoring, dark mode, asistan, vs.)
 * popup tarafinda yonetir.
 *
 * Sorumluluklar:
 *  - Mount'ta background'dan GET_SETTINGS ile baslangic ceker.
 *  - chrome.storage.sync'deki "settings" anahtarini dinler — diger
 *    sekmeler (Tum Ayarlar sayfasi, intro ekrani vb.) ayarlari
 *    degistirirse popup anlik senkron olur.
 *  - saveSettings(): hem local state'i hem background'i guncel tutar
 *    (storage.sync.set + SETTINGS_UPDATED mesaji).
 *
 * Geri donulen:
 *  - settings: anlik degerler (null = henuz yuklenmedi)
 *  - saveSettings: tum ayar nesnesiyle yeniden yazma helper'i
 *  - setSettings: nadir durumlar icin local-only setter
 */
export function useExtensionSettings(): {
  settings: ExtensionSettings | null;
  /** React'in standart setState signature'i — degeri ya da fonksiyonu kabul eder. */
  setSettings: Dispatch<SetStateAction<ExtensionSettings | null>>;
  saveSettings: (s: ExtensionSettings) => void;
} {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);

  // Mount'ta baslangic verisi: GET_SETTINGS mesaji background'in tutarli
  // olarak DEFAULT_SETTINGS uzerine merge edip donen sonuc.
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "GET_SETTINGS" },
      (response: { settings: ExtensionSettings } | null) => {
        if (response?.settings) setSettingsState(response.settings);
      },
    );
  }, []);

  // chrome.storage.sync'deki "settings" anahtari degisirse anlik senkron.
  // Tum Ayarlar sayfasindan toggle degistirildiginde popup acikken hemen
  // yansisin diye.
  useEffect(() => {
    const onChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "sync" || !changes.settings) return;
      const next = changes.settings.newValue as ExtensionSettings | undefined;
      if (next) setSettingsState(next);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const saveSettings = useCallback((updated: ExtensionSettings) => {
    setSettingsState(updated);
    chrome.storage.sync.set({ settings: updated }, () => {
      chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: updated });
    });
  }, []);

  return { settings, setSettings: setSettingsState, saveSettings };
}
