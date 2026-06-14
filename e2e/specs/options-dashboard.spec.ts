import { test, expect } from "../fixtures/extension";
import { openOptionsPage, navigateToSite } from "../helpers/extension-page";
import { routeExampleCom } from "../helpers/site-routes";

test.describe("Options Page — Happy Path", () => {
  test("should render options page header", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Alparslan Ayarlar")).toBeVisible();
    await options.close();
  });

  test("should show protection level settings", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Koruma Seviyesi")).toBeVisible();
    await expect(options.getByText("Düşük")).toBeVisible();
    await expect(options.getByText("Orta")).toBeVisible();
    await expect(options.getByText("Yüksek")).toBeVisible();
    await options.close();
  });

  test("should allow changing protection level", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await options.getByText("Yüksek").click();
    await expect(options.getByText("Ayarlar kaydedildi")).toBeVisible({ timeout: 3000 });
    await options.close();
  });

  test("should allow adding to whitelist", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // Refactor sonrasi "Beyaz Liste" basligi "Güvendiğim Bağlantılar" oldu.
    await expect(
      options.getByRole("heading", { name: "Güvendiğim Bağlantılar" }),
    ).toBeVisible({ timeout: 5000 });
    // Placeholder eskiden "örnek: example.com" idi, simdi "İstisna
    // tutulacak web adresini girin...". Regex ile esnek erisim.
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
    await expect(
      options.getByRole("heading", { name: "Güvendiğim Bağlantılar" }),
    ).toBeVisible({ timeout: 5000 });
    // Refactor sonrasi "Beyaz liste boş" mesaji "Güvendiğiniz bağlantı
    // listesi boş" olarak yeniden adlandirildi.
    await expect(options.getByText("Güvendiğiniz bağlantı listesi boş")).toBeVisible();
    // Click Ekle with empty input
    await options.getByRole("button", { name: "Ekle" }).click();
    // Liste hala bos olmali
    await expect(options.getByText("Güvendiğiniz bağlantı listesi boş")).toBeVisible();
    await options.close();
  });

  test("negative: should handle data clear gracefully", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // "Tüm Verileri Temizle" artik direkt silmiyor, once onay modali aciliyor.
    // Modal'da "Evet, Hepsini Temizle" butonuna basinca asil silme tetiklenir.
    await options.getByText("Tüm Verileri Temizle").click();
    await options.getByRole("button", { name: "Evet, Hepsini Temizle" }).click();
    await expect(options.getByText("Veriler temizlendi")).toBeVisible({ timeout: 5000 });
    await expect(options.getByText("Koruma Seviyesi")).toBeVisible();
    await options.close();
  });
});
