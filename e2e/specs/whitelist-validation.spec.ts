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

      await options.getByRole("textbox").fill(entry.raw);
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
    await expect(
      options.getByText("Güvendiğiniz bağlantı listesi boş"),
    ).toBeVisible();

    for (const raw of [".com", "com", "com.tr", "co.uk", "", "http://"]) {
      await options.getByRole("textbox").fill(raw);
      await options.getByRole("button", { name: "Ekle" }).click();
      await expect(
        options.getByText("Güvendiğiniz bağlantı listesi boş"),
      ).toBeVisible();
    }

    await options.close();
  });
});
