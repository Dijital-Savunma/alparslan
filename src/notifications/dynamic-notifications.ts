/**
 * Uzaktan fetch'lenen kullanici bildirimleri sistemi.
 *
 * Statik changelogs.ts'in yerine gecer — release yapmadan bilidirm
 * gondermek istenirse, repo'daki lists/notifications.json'i guncellemek
 * yeterli; jsDelivr CDN uzerinden ~12 saatte tum kullanicilara ulasir.
 *
 * Mimari:
 *  - Background SW her 6 saatte bir notifications.json fetch'ler,
 *    chrome.storage.local'a saklar.
 *  - Popup mount'unda storage'dan okur, kullanicinin dismiss'lemedigi
 *    en son bildirimi gosterir.
 *  - Dismiss'lar id bazlidir — versiyon bagimsiz, kullanici tek tek
 *    her bildirimi susturabilir.
 */

import { logger } from "@/utils/logger";

const NOTIFICATIONS_URL =
  "https://cdn.jsdelivr.net/gh/Dijital-Savunma/alparslan@main/lists/notifications.json";

export const NOTIFICATIONS_CACHE_STORAGE_KEY = "notificationsCache";
export const NOTIFICATIONS_CACHE_AT_STORAGE_KEY = "notificationsCacheUpdatedAt";
export const DISMISSED_NOTIFICATION_IDS_STORAGE_KEY = "dismissedNotificationIds";

/**
 * Uzaktan gelen tek bir bildirim. Sema esnek — yeni alanlar (icon, type,
 * link vb.) ileride eklenebilir, eski popup'lar yeni alanlari gormeyebilir
 * ama core (id/title/lines) calismaya devam eder.
 */
export interface DynamicNotification {
  /** Tekil id — dismiss takibi bu key uzerinden yapilir. Sabit kalmali. */
  id: string;
  /** Kart basligi. */
  title: string;
  /** Madde listesi — her satir bir bullet. */
  lines: string[];
  /** ISO date — UI'da gosterilmiyor su an, ileride "yeni" rozeti icin. */
  publishedAt?: string;
}

export interface NotificationsFeed {
  version?: string;
  notifications: DynamicNotification[];
}

async function persistNotificationsCache(feed: NotificationsFeed): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        [NOTIFICATIONS_CACHE_STORAGE_KEY]: feed.notifications,
        [NOTIFICATIONS_CACHE_AT_STORAGE_KEY]: Date.now(),
      },
      () => resolve(),
    );
  });
}

/**
 * Background SW bunu hem init'te hem chrome.alarms'la 6 saatte bir cagiriyor.
 *
 * Strateji: HEM bundled HEM uzak CDN'i cek, sonra `version` alanina gore
 * daha yenisini cache'le. version ISO tarih (YYYY-MM-DD) — sozluksel
 * karsilastirma kronolojik. Boylece:
 *
 *  - Yeni bir release yayinlandiginda bundled hep en yeni — kullanici
 *    uzantiyi guncelleyince CDN eskise bile dogru icerigi gorur.
 *  - Release'ler arasi CDN'e push'lanan guncellemeler dogal olarak
 *    bundled'dan daha yeni olur ve kazanir.
 *  - Iki kaynak da basarisizsa mevcut cache'e dokunmayiz.
 */
export async function fetchAndCacheNotifications(): Promise<void> {
  // Bundled — extension paketinde her zaman var (chrome.runtime.getURL).
  const bundledFeed = await loadFeed(
    chrome.runtime.getURL("lists/notifications.json"),
    "bundled",
  );

  // Uzak CDN — release yapmadan herkese yeni bildirim icin.
  const remoteFeed = await loadFeed(NOTIFICATIONS_URL, "remote", { cache: "no-cache" });

  const chosen = pickNewerFeed(bundledFeed, remoteFeed);
  if (chosen) {
    await persistNotificationsCache(chosen);
    logger.debug(`Notifications cached (version ${chosen.version ?? "n/a"}, ${chosen.notifications.length} items)`);
    return;
  }

  logger.warn("Notifications: both bundled and remote failed; keeping existing cache");
}

async function loadFeed(
  url: string,
  label: string,
  init?: RequestInit,
): Promise<NotificationsFeed | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      logger.warn(`Notifications ${label} HTTP ${response.status}`);
      return null;
    }
    const feed = (await response.json()) as NotificationsFeed;
    if (!feed || !Array.isArray(feed.notifications)) {
      logger.warn(`Notifications ${label}: invalid shape`);
      return null;
    }
    return feed;
  } catch (err) {
    logger.warn(`Notifications ${label} fetch error:`, err);
    return null;
  }
}

function pickNewerFeed(
  a: NotificationsFeed | null,
  b: NotificationsFeed | null,
): NotificationsFeed | null {
  if (!a) return b;
  if (!b) return a;
  // ISO tarih (YYYY-MM-DD) sozluksel olarak karsilastirilabilir; eksik
  // version bos string olur ve kaybeder.
  return (b.version ?? "") > (a.version ?? "") ? b : a;
}

/** Cache'lenmis bildirimleri donder — pop'up bunu okur. */
export function getCachedNotifications(): Promise<DynamicNotification[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([NOTIFICATIONS_CACHE_STORAGE_KEY], (result) => {
      const cached = result[NOTIFICATIONS_CACHE_STORAGE_KEY];
      resolve(Array.isArray(cached) ? (cached as DynamicNotification[]) : []);
    });
  });
}
