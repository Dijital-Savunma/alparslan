import { test, expect } from "../fixtures/extension";
import { openOptionsPage, navigateToSite } from "../helpers/extension-page";
import { routeExampleCom } from "../helpers/site-routes";

test.describe("Options Page — Happy Path", () => {
  test("should render options page header", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Alparslan Ayarlar")).toBeVisible();
    await options.close();
  });

  // NOT: "Koruma Seviyesi" UI bolumu kaldirildi (low/medium/high secimi
  // gerek gormedik). protectionLevel ayari arka planda hala mevcut ve
  // detection threshold'lari icin kullaniliyor, sadece UI cikti.

  test("should allow adding to whitelist", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // Options default section artik "Genel Ayarlar" — Whitelist heading'ini
    // gorebilmek icin once sidebar'daki "Güvendiğim Bağlantılar" butonuna
    // basmamiz gerek (SidebarNavItem = native <button>).
    // Sidebar butonu tek eslesme — heading ("Güvendiğim Bağlantılar") ve
    // liste ustundeki h2 ("Güvendiğim Bağlantılar Listesi") default
    // section (Genel Ayarlar) iken gorunmez, click strict-mode'da guvenli.
    await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
    // Sekme acildiginda hem h1 (tam eslesme) hem h2 ("... Listesi") gorunur.
    // exact: true ile sadece h1'i secmek strict-mode multiple-match hatasini
    // engeller.
    await expect(
      options.getByRole("heading", { name: "Güvendiğim Bağlantılar", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    const input = options.getByPlaceholder(/istisna|adresini girin|example\.com/i);
    await expect(input).toBeVisible();
    await input.fill("test-safe-site.com");
    await options.getByRole("button", { name: "Ekle" }).click();
    await expect(options.getByText("test-safe-site.com")).toBeVisible();
    await options.close();
  });

  test("should show security summary after browsing", async ({ context, extensionId }) => {
    await routeExampleCom(context);
    const page = await navigateToSite(context, "https://example.com");
    await page.waitForTimeout(1000);
    await page.close();

    const options = await openOptionsPage(context, extensionId);
    await options.waitForTimeout(1000);
    await expect(options.getByText("Alparslan Ayarlar")).toBeVisible();
    await options.close();
  });
});

test.describe("Options Page — Negative Scenarios", () => {
  test("negative: should not add empty domain to whitelist", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // Sidebar sekmesine gec — happy-path testinde de ayni yaklasim.
    // Sidebar butonu tek eslesme — heading ("Güvendiğim Bağlantılar") ve
    // liste ustundeki h2 ("Güvendiğim Bağlantılar Listesi") default
    // section (Genel Ayarlar) iken gorunmez, click strict-mode'da guvenli.
    await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
    // Sekme acildiginda hem h1 (tam eslesme) hem h2 ("... Listesi") gorunur.
    // exact: true ile sadece h1'i secmek strict-mode multiple-match hatasini
    // engeller.
    await expect(
      options.getByRole("heading", { name: "Güvendiğim Bağlantılar", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    // Refactor sonrasi bos-liste mesaji "Liste henüz boş" oldu.
    await expect(options.getByText("Liste henüz boş")).toBeVisible();
    // Input bosken Ekle butonu disabled attribute'u alir; playwright'in
    // click()'i disabled buton'a error firlatir. Assertion olarak
    // disabled state'i test etmek yeterli — kullanici zaten bu haldeyken
    // bir sey yazamaz, liste bos kalir.
    await expect(options.getByRole("button", { name: "Ekle" })).toBeDisabled();
    await expect(options.getByText("Liste henüz boş")).toBeVisible();
    await options.close();
  });

  test("negative: should handle data clear gracefully", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // "Tüm Verileri Temizle" artik direkt silmiyor, once onay modali aciliyor.
    // Modal'da "Evet, Hepsini Temizle" butonuna basinca asil silme tetiklenir.
    await options.getByText("Tüm Verileri Temizle").click();
    await options.getByRole("button", { name: "Evet, Hepsini Temizle" }).click();
    await expect(options.getByText("Veriler temizlendi")).toBeVisible({ timeout: 5000 });
    // Sayfa hala duruyor — temizleme sonrasi baska section'da bir baslik
    // var oldugundan emin olalim (Tehlike Uyarilari toggle bolumu).
    await expect(options.getByText("Bildirimler")).toBeVisible();
    await options.close();
  });
});
