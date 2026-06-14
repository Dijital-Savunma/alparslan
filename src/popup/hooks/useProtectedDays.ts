import { useEffect, useState } from "react";

/**
 * Kullanicinin Alparslan ile kac gundur korunduğunu hesaplar.
 *
 * "Koruma sistemini başlat" (intro ekrani) ilk kez basildiginda
 * settings.protectionStartedAt yazilir; biz o tarihten bu yana gecen
 * gun sayisini hesapliyoruz (minimum 1: "0 gundur korunuyorsunuz" yerine
 * "1 gundur korunuyorsunuz" daha kibar bir baslangic).
 *
 * Hooktan don: anlik protectedDays sayisi (varsayilan 1).
 */
export function useProtectedDays(): number {
  const [protectedDays, setProtectedDays] = useState<number>(1);

  useEffect(() => {
    chrome.storage.sync.get(["settings"], (result) => {
      const settings = result.settings || {};
      const startedAt =
        typeof settings.protectionStartedAt === "number"
          ? settings.protectionStartedAt
          : Date.now();
      const days = Math.max(
        1,
        Math.floor((Date.now() - startedAt) / (1000 * 60 * 60 * 24)) + 1,
      );
      setProtectedDays(days);
    });
  }, []);

  return protectedDays;
}
