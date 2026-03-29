import { test, expect } from "../fixtures/extension";
import { openPopup, navigateToSite } from "../helpers/extension-page";

test.describe("Breach Check — Happy Path", () => {
  test("should show breach badge in popup for known breached site", async ({ context, extensionId }) => {
    const page = await navigateToSite(context, "https://www.linkedin.com");
    await page.waitForTimeout(2000);

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText(/veri sizintisi/)).toBeVisible({ timeout: 5000 });
    await popup.close();
    await page.close();
  });

  test("should show breach info banner on page of breached site", async ({ context, extensionId }) => {
    const page = await navigateToSite(context, "https://www.linkedin.com");
    await page.waitForTimeout(2000);

    const bannerHost = page.locator("#alparslan-breach-host");
    await expect(bannerHost).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test("should not show breach badge for non-breached site", async ({ context, extensionId }) => {
    const page = await navigateToSite(context, "https://example.com");
    await page.waitForTimeout(1500);

    const popup = await openPopup(context, extensionId);
    const breachCount = await popup.getByText(/veri sizintisi/).count();
    expect(breachCount).toBe(0);
    await popup.close();
    await page.close();
  });

  test("should show breach details with data types", async ({ context, extensionId }) => {
    const page = await navigateToSite(context, "https://www.linkedin.com");
    await page.waitForTimeout(2000);

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText(/email/)).toBeVisible({ timeout: 5000 });
    await popup.close();
    await page.close();
  });
});

test.describe("Breach Check — Negative Scenarios", () => {
  test("negative: should not show breach banner on extension pages", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    const breachCount = await popup.getByText(/veri sizintisi/).count();
    expect(breachCount).toBe(0);
    await popup.close();
  });

  test("negative: should not crash on about:blank", async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto("about:blank");
    await page.waitForTimeout(500);

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText("Alparslan")).toBeVisible();
    await popup.close();
    await page.close();
  });

  test("negative: breach banner host should be removable from DOM", async ({ context, extensionId }) => {
    const page = await navigateToSite(context, "https://www.linkedin.com");
    await page.waitForTimeout(2000);

    const bannerHost = page.locator("#alparslan-breach-host");
    if (await bannerHost.isVisible()) {
      await page.evaluate(() => {
        const host = document.getElementById("alparslan-breach-host");
        host?.remove();
      });
      await expect(bannerHost).not.toBeVisible();
    }
    await page.close();
  });
});
