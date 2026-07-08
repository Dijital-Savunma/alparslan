import { test, expect } from "../fixtures/extension";
import { openOptionsPage } from "../helpers/extension-page";
import { removeFromWhitelist } from "../helpers/extension-messaging";
import type { Page } from "@playwright/test";

async function resetOptionsStorage(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.sync.clear(() => resolve());
      }),
  );
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

const validCases = [
  { raw: "example.com", normalized: "example.com" },
  { raw: "https://example.com/path?x=1", normalized: "example.com" },
  { raw: "https://www.example.com:8443/", normalized: "www.example.com" },
];

test.describe("Whitelist validation", () => {
  // Her case kendi test bloğunda çalışır → ayrı context → temiz IDB
  for (const entry of validCases) {
    test(`accepts valid entry: "${entry.raw}" → "${entry.normalized}"`, async ({
      context,
      extensionId,
    }) => {
      const options = await openOptionsPage(context, extensionId);
      await resetOptionsStorage(options);

      // Default section artik "Genel Ayarlar" — whitelist input'a erisim
      // icin sidebar'daki "Güvendiğim Bağlantılar" sekmesine gec.
      await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
      // Sayfada arama + whitelist input dahil birden fazla textbox var;
      // placeholder ile spesifik hedefle strict-mode'u koru.
      await options.getByPlaceholder(/istisna|adresini girin|example\.com/i).fill(entry.raw);
      await options.getByRole("button", { name: "Ekle" }).click();
      await expect(
        options.getByText(entry.normalized, { exact: true }),
      ).toBeVisible();

      // Temizlik: IDB kaydını kaldır
      await removeFromWhitelist(options, entry.normalized);

      await options.close();
    });
  }

  test("rejects public suffixes and empty URL inputs", async ({
    context,
    extensionId,
  }) => {
    const options = await openOptionsPage(context, extensionId);
    await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
    await expect(options.getByText("Liste henüz boş")).toBeVisible();

    const input = options.getByPlaceholder(/istisna|adresini girin|example\.com/i);
    const ekleBtn = options.getByRole("button", { name: "Ekle" });
    for (const raw of [".com", "com", "com.tr", "co.uk", "", "http://"]) {
      await input.fill(raw);
      // Bos veya rejected girisler icin Ekle disabled state'inde kalirsa
      // dogrudan click yerine assertion; disabled degilse click ile
      // dogrula ki liste hala bos kalsin.
      if (await ekleBtn.isDisabled()) {
        await expect(options.getByText("Liste henüz boş")).toBeVisible();
        continue;
      }
      await ekleBtn.click();
      await expect(options.getByText("Liste henüz boş")).toBeVisible();
    }

    await options.close();
  });
});
