import { useEffect, useState, useRef } from "react";

/**
 * "Canlı Odometre" sayı animasyonu.
 *
 * Bir sayı değerini ekrana statik (donmuş) bir şekilde göstermek yerine,
 * popup acildiginda (veya hedef deger her degistiginde) 0'dan baslayip
 * `duration` ms icinde gercek degere yuvarlanir. ease-out cubic egrisi
 * sayinin once hizli, sonra yavasca yerlesmesini saglar — odometre/HUD
 * havasi verir, kullaniciya yazilimin "canlı" oldugu hissini yasatir.
 *
 * Kullanim:
 *   const animated = useCountUp(value, 300);
 *   <span>{animated}</span>
 *
 * Negatif hedef degerlere de tam destek vardir (Skor breakdown'inda
 * "(-20 Puan)" gibi animasyonlu hedeflerde absolut buyukluk uzerinden
 * yuvarlanip isaret korunur).
 *
 * Performans:
 *  - requestAnimationFrame ile tek bir RAF dongusu kullanir.
 *  - Hedef degeri 0 ise animasyon kosmaz (gereksiz tick'ten kacinilir).
 *  - Cleanup, bilesen unmount edilirse cancelAnimationFrame ile RAF'i
 *    temizler, leak yoktur.
 */
export function useCountUp(value: number, duration = 300): number {
  const [display, setDisplay] = useState(0);
  // Hedef degeri ref'te tutarak, animasyon ortasinda yeni bir target
  // gelirse mevcut RAF onu kullanabilsin (race yok).
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const startValue = 0;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic: hizli ilerle, sonunda yumusakca otur.
      const eased = 1 - Math.pow(1 - progress, 3);
      const target = targetRef.current;
      // Negatif hedefte mutlak deger uzerinden yuvarla, isareti koru.
      const sign = target < 0 ? -1 : 1;
      const absTarget = Math.abs(target);
      const next = sign * Math.round((absTarget - Math.abs(startValue)) * eased + Math.abs(startValue));
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return display;
}
