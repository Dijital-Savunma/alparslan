import { useEffect, useState } from "react";

/**
 * Background service worker'in baslangic (USOM, whitelist, list cache vb.)
 * yukleme durumunu polling ile takip eder. Backoff'lu polling: ilk istek
 * 300ms, sonrasinda 1.5× kati ile artarak 5 saniyede tavan yapar. Bu
 * sayede SW her wake-up'inda eski sabit 300ms-loop'undaki kadar mesaj
 * almiyor (uzun init'lerde dakikada 200 mesajdan ~10-15 mesaja iniyor).
 *
 * Geri donulen veri:
 *  - initStatus: SW'den son alinan durum (null = henuz cevap yok)
 *  - initDoneSession: bu Chrome oturumunda init bari daha once gosterildi
 *    mi? (true => skip et, false => goster, null => okunuyor)
 *
 * Component tarafinda kullanim:
 *   const { initStatus, initDoneSession } = useInitProgress();
 *   if (initDoneSession === false && initStatus && !initStatus.ready) ...
 */

export interface InitStatus {
  ready: boolean;
  step: string;
  percent: number;
  steps: { name: string; done: boolean; ms?: number }[];
}

const SESSION_DONE_KEY = "alparslanInitDone";
const POLL_INITIAL_DELAY_MS = 300;
const POLL_MAX_DELAY_MS = 5000;
const POLL_BACKOFF_FACTOR = 1.5;

export function useInitProgress(): {
  initStatus: InitStatus | null;
  initDoneSession: boolean | null;
} {
  const [initStatus, setInitStatus] = useState<InitStatus | null>(null);
  // null = okunuyor; true = bu oturumda yukleme bari zaten oynandi
  // (atla); false = ilk cold-start, bar gosterilebilir.
  const [initDoneSession, setInitDoneSession] = useState<boolean | null>(null);

  // chrome.storage.session destegi yoksa (eski chrome / test ortami) bari
  // her zaman goster: false ata ki UI dallari calismaya devam etsin.
  useEffect(() => {
    if (!chrome.storage.session?.get) {
      setInitDoneSession(false);
      return;
    }
    chrome.storage.session.get(SESSION_DONE_KEY, (r: { [k: string]: unknown }) => {
      setInitDoneSession(!!r?.[SESSION_DONE_KEY]);
    });
  }, []);

  // Backoff'lu polling. Cleanup'da hem bekleyen timeout'u iptal eder hem
  // de "yarisma" durumlarinin yan etkisini engellemek icin `cancelled`
  // bayragiyla sonraki setState'lere kapali kalir.
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = POLL_INITIAL_DELAY_MS;

    function poll(): void {
      chrome.runtime.sendMessage({ type: "GET_INIT_STATUS" }, (response: InitStatus | null) => {
        if (cancelled) return;
        if (response) {
          setInitStatus(response);
          if (response.ready) {
            // Hazir — daha fazla polling yok.
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            return;
          }
        }
        // Henuz hazir degil — bir sonraki polling'i backoff ile planla.
        currentDelay = Math.min(POLL_MAX_DELAY_MS, Math.round(currentDelay * POLL_BACKOFF_FACTOR));
        timeout = setTimeout(poll, currentDelay);
      });
    }

    poll();
    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  }, []);

  return { initStatus, initDoneSession };
}
