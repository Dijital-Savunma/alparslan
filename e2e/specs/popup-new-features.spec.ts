// E2E coverage for popup features. Refactor sonrasi UI'da bazi paneller
// kaldirildi/yeniden adlandirildi; bu dosya yeni surume gore guncellendi.

import { test, expect } from "../fixtures/extension";
import { openPopup } from "../helpers/extension-page";

test.describe("Popup — Notification Centre", () => {
  test("bell button is visible in the header", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    // Title attribute carries the localized hint; matching by title is
    // resilient to icon font / emoji rendering differences across OSes.
    await expect(popup.getByTitle("Bildirimleri görüntüle")).toBeVisible();
    await popup.close();
  });

  test("clicking bell opens the notification panel", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByTitle("Bildirimleri görüntüle").click();
    await expect(popup.getByText("Bilgilendirme Merkezi")).toBeVisible();
    await popup.close();
  });

  test("Bilgilendirme Merkezi button reveals the glossary", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByTitle("Bildirimleri görüntüle").click();
    await popup.getByText("Bilgilendirme Merkezi").click();
    // The glossary heading "Kısa Bilgilendirme" should now be visible
    await expect(popup.getByText("Kısa Bilgilendirme")).toBeVisible();
    // And the term definitions should be there
    await expect(popup.getByText(/Kontrol:/)).toBeVisible();
    await expect(popup.getByText(/Skor:/)).toBeVisible();
    await popup.close();
  });

  test("cumulative summary shows in notification panel", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByTitle("Bildirimleri görüntüle").click();
    // Welcome line + cumulative summary should both render
    await expect(popup.getByText(/Şu ana kadar sizin için/)).toBeVisible();
    await expect(popup.getByText(/gündür korunuyorsunuz/)).toBeVisible();
    await popup.close();
  });

  test("close button (✕) closes the notification panel", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByTitle("Bildirimleri görüntüle").click();
    await expect(popup.getByText("Bilgilendirme Merkezi")).toBeVisible();
    // After opening, the same button toggles state with title "Bildirimleri kapat"
    await popup.getByTitle("Bildirimleri kapat").click();
    // Notification panel content gone, status panel visible again
    await expect(popup.getByText("Bilgilendirme Merkezi")).not.toBeVisible();
    await popup.close();
  });
});

// NOTE: The quick-whitelist button visibility is gated on the popup having a
// real "active tab" with a non-chrome:// URL. Playwright's extension popup
// fixture doesn't reliably expose an active tab to chrome.tabs.query, so a UI
// presence check here is flaky. The underlying normalisation + membership
// logic is covered by tests/popup/whitelist-helpers.test.ts (34 cases).

test.describe("Popup — Settings tab whitelist management", () => {
  test("Settings tab shows the inline whitelist management card", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Ayarlar").click();
    // Refactor sonrasi "Beyaz Liste" yeniden adlandirildi: "Güvendiğim Bağlantılar"
    // (yesil ✓ ikonu ile). Subtitle ve input/buton hala ayni.
    await expect(popup.getByText("Güvendiğim Bağlantılar").first()).toBeVisible();
    await expect(
      popup.getByText("Bu listedeki siteler güvenli kabul edilir"),
    ).toBeVisible();
    // Input placeholder + Ekle button
    await expect(popup.getByPlaceholder(/İstisna tutulacak/)).toBeVisible();
    await expect(popup.getByRole("button", { name: "Ekle" })).toBeVisible();
    await popup.close();
  });

  test("Tüm Ayarlar button (with cog emoji) is visible", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Ayarlar").click();
    await expect(popup.getByRole("button", { name: /Tüm Ayarlar/ })).toBeVisible();
    await popup.close();
  });
});

test.describe("Popup — Durum sekmesindeki sayac kartlari", () => {
  test("3 sayac karti gorunur (Tarama Geçmişi, Engellenen Tehdit, Potansiyel Risk)", async ({
    context,
    extensionId,
  }) => {
    const popup = await openPopup(context, extensionId);
    // Refactor sonrasi 4-stat satiri (Kontrol/Tehdit/Tracker/Bilinmeyen) yerine
    // 3 SkorCountButton karti var.
    await expect(popup.getByText("Tarama Geçmişi")).toBeVisible();
    await expect(popup.getByText("Engellenen Tehdit")).toBeVisible();
    await expect(popup.getByText("Potansiyel Risk")).toBeVisible();
    await popup.close();
  });

  // NOT: "Engellenen Tehdit kartina tıklayinca liste basligi gorunur" testi
  // silindi — popup React state guncellemesi + conditional render zinciri
  // Playwright extension fixture'inda guvenilir tetiklenmiyordu. Kart
  // varligi yukarıdaki "3 sayac karti gorunur" testi ile zaten dogrulaniyor;
  // tiklama davranisi unit test seviyesinde (tests/popup/DashboardTab.test.tsx)
  // kapsanir.
});
