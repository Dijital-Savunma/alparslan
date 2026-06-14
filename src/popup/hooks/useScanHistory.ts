import { useEffect, useState, useCallback } from "react";
import { type ScanHistoryEntry } from "@/utils/types";

/**
 * Alparslan'in tarama gecmisini yonetir.
 *
 * Sorumluluklar:
 *  - Mount'ta background'dan GET_HISTORY ile baslangic verisini ceker.
 *  - chrome.storage.local'daki "history" anahtarini dinler — background
 *    yeni bir ziyaret kaydederse popup acikken bile anlik senkron olur.
 *  - reloadHistory(): manuel refresh icin (orn. RESET_SCORE sonrasi).
 *  - clearLocalHistory(): popup-internal state'i bosaltir (CLEAR_HISTORY
 *    sonrasi).
 *
 * App.tsx (Durum sekmesi) + DashboardTab (Skor sekmesi) ayni hook'u
 * kullansin diye dosya hooks/ altinda; ayni anda iki yerden cagrilirsa
 * her bilesen kendi local state'ini tutar (ufak duplikasyon, ama
 * React'in dogal davranisi).
 */
export function useScanHistory(): {
  history: ScanHistoryEntry[];
  reloadHistory: () => void;
  clearLocalHistory: () => void;
} {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  const reloadHistory = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_HISTORY" },
      (response: { history: ScanHistoryEntry[] } | null) => {
        if (response?.history) setHistory(response.history);
      },
    );
  }, []);

  const clearLocalHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Mount'ta baslangic verisi + reaktif senkron dinleyici.
  useEffect(() => {
    reloadHistory();
    const onChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.history) return;
      const next = changes.history.newValue as ScanHistoryEntry[] | undefined;
      if (Array.isArray(next)) setHistory(next);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [reloadHistory]);

  return { history, reloadHistory, clearLocalHistory };
}
