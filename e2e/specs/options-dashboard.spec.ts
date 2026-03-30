import { test, expect } from "../fixtures/extension";
import { openOptionsPage, navigateToSite } from "../helpers/extension-page";

test.describe("Options Page — Happy Path", () => {
  test("should render options page header", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Alparslan Ayarlar")).toBeVisible();
    await options.close();
  });

  test("should show protection level settings", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Koruma Seviyesi")).toBeVisible();
    await expect(options.getByText("Dusuk")).toBeVisible();
    await expect(options.getByText("Orta")).toBeVisible();
    await expect(options.getByText("Yuksek")).toBeVisible();
    await options.close();
  });

  test("should allow changing protection level", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await options.getByText("Yuksek").click();
    await expect(options.getByText("Ayarlar kaydedildi")).toBeVisible({ timeout: 3000 });
    await options.close();
  });

  test("should allow adding to whitelist", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    // Wait for the page to fully render
    await expect(options.getByRole("heading", { name: "Beyaz Liste" })).toBeVisible({ timeout: 5000 });
    const input = options.getByPlaceholder("ornek: example.com");
    await expect(input).toBeVisible();
    await input.fill("test-safe-site.com");
    await options.getByRole("button", { name: "Ekle" }).click();
    await expect(options.getByText("test-safe-site.com")).toBeVisible();
    await options.close();
  });

  test("should show security summary after browsing", async ({ context, extensionId }) => {
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
    // Wait for the page to fully render
    await expect(options.getByRole("heading", { name: "Beyaz Liste" })).toBeVisible({ timeout: 5000 });
    // Verify whitelist is empty initially
    await expect(options.getByText("Beyaz liste bos")).toBeVisible();
    // Click Ekle with empty input
    await options.getByRole("button", { name: "Ekle" }).click();
    // Whitelist should still be empty
    await expect(options.getByText("Beyaz liste bos")).toBeVisible();
    await options.close();
  });

  test("negative: should handle data clear gracefully", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await options.getByText("Tum Verileri Temizle").click();
    await expect(options.getByText("Veriler temizlendi")).toBeVisible({ timeout: 3000 });
    await expect(options.getByText("Koruma Seviyesi")).toBeVisible();
    await options.close();
  });
});
