import { test, expect } from "../fixtures/extension";
import { openPopup } from "../helpers/extension-page";

test.describe("Popup Navigation", () => {
  test("should show header with Alparslan branding", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText("Alparslan").first()).toBeVisible();
    await popup.close();
  });

  test("should show Durum and Skor tabs", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText("Durum")).toBeVisible();
    await expect(popup.getByText("Skor")).toBeVisible();
    await popup.close();
  });

  test("should default to Durum tab with stats visible", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText("Kontrol")).toBeVisible();
    await expect(popup.getByText("Tehdit")).toBeVisible();
    await popup.close();
  });

  test("should switch to Skor tab when clicked", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Haftalık Güvenlik Skoru")).toBeVisible();
    await popup.close();
  });

  test("should switch back to Durum tab", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Haftalık Güvenlik Skoru")).toBeVisible();
    await popup.getByText("Durum").click();
    await expect(popup.getByText("Kontrol")).toBeVisible();
    await popup.close();
  });

  test("should show toggle switch in header", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByText("Aktif")).toBeVisible();
    await popup.close();
  });

  test("negative: should show disabled state when toggled off", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    // Click the toggle track div (width: 36px, inside the header label)
    const toggleTrack = popup.locator('label div[style*="width: 36px"]');
    await toggleTrack.click();
    await expect(popup.getByText("Pasif")).toBeVisible();
    await expect(popup.getByText("Koruma Kapalı")).toBeVisible();
    await popup.close();
  });
});
