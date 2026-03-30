import { test, expect } from "../fixtures/extension";
import { openPopup, navigateToSite, openOptionsPage } from "../helpers/extension-page";

test.describe("Dashboard Score — Happy Path", () => {
  test("should show score with no browsing activity", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Haftalik Guvenlik Skoru")).toBeVisible();
    await popup.close();
  });

  test("should show score breakdown categories", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    // Wait for dashboard to load (loading state shows "Yukleniyor...")
    await expect(popup.getByText("Haftalik Guvenlik Skoru")).toBeVisible({ timeout: 10000 });
    await expect(popup.getByText("HTTPS").first()).toBeVisible();
    await expect(popup.getByText("Tehdit").first()).toBeVisible();
    await expect(popup.getByText("Aktivite")).toBeVisible();
    await expect(popup.getByText("Tracker").first()).toBeVisible();
    await popup.close();
  });

  test("should show tips for new user", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Oneriler")).toBeVisible();
    await popup.close();
  });

  test("should update score after browsing HTTPS sites", async ({ context, extensionId }) => {
    const page1 = await navigateToSite(context, "https://example.com");
    await page1.waitForTimeout(1000);
    await page1.close();

    const page2 = await navigateToSite(context, "https://www.google.com");
    await page2.waitForTimeout(1000);
    await page2.close();

    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await popup.waitForTimeout(500);

    const scoreElement = popup.locator('[style*="font-size: 28px"]');
    const scoreText = await scoreElement.textContent();
    const score = parseInt(scoreText || "0", 10);
    expect(score).toBeGreaterThan(0);
    await popup.close();
  });

  test("should show options page header", async ({ context, extensionId }) => {
    const options = await openOptionsPage(context, extensionId);
    await expect(options.getByText("Alparslan Ayarlar")).toBeVisible();
    await options.close();
  });
});

test.describe("Dashboard Score — Negative Scenarios", () => {
  test("negative: score should not exceed 100", async ({ context, extensionId }) => {
    for (let i = 0; i < 5; i++) {
      const page = await navigateToSite(context, "https://example.com");
      await page.waitForTimeout(300);
      await page.close();
    }

    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await popup.waitForTimeout(500);
    const scoreElement = popup.locator('[style*="font-size: 28px"]');
    const scoreText = await scoreElement.textContent();
    const score = parseInt(scoreText || "0", 10);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
    await popup.close();
  });

  test("negative: dashboard should handle extension disabled state", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Aktif").click();
    await popup.waitForTimeout(300);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Haftalik Guvenlik Skoru")).toBeVisible();
    await popup.close();
  });
});
