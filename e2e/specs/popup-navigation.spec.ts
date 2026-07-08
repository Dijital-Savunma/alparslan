import { test, expect } from "../fixtures/extension";
import { openPopup } from "../helpers/extension-page";

test.describe("Popup Navigation", () => {
  test("should show header with Alparslan branding", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    // Scope to #root: the onboarding overlay (#introScreen, outside the React
    // tree) also contains an "Alparslan ..." title, so an unscoped
    // getByText(...).first() can resolve to that hidden node.
    await expect(popup.locator("#root").getByText("Alparslan").first()).toBeVisible();
    await popup.close();
  });

  test("should show Durum and Skor tabs", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    // `.first()` — "Durum"/"Skor" speech-bubble copy de bu kelimeleri
    // tasiyor; strict-mode'da multiple-match'i kacinmak icin tab bar'da
    // gozuken ilk insanca okunabilen olusumu hedefliyoruz.
    await expect(popup.getByText("Durum").first()).toBeVisible();
    await expect(popup.getByText("Skor").first()).toBeVisible();
    await popup.close();
  });

  test("should default to Durum tab with stat cards visible", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    // Durum sekmesindeki sayac kartlari: "Kontrol Geçmişi", "Tehlikeli Adresler",
    // "Şüpheli Durumlar". Iki orta kart varligini test ediyor.
    await expect(popup.getByText("Kontrol Geçmişi")).toBeVisible();
    await expect(popup.getByText("Tehlikeli Adresler")).toBeVisible();
    await popup.close();
  });

  test("should switch to Skor tab when clicked", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    // "Haftalık Güvenlik Skoru" basligi "Günlük skor" oldu.
    await expect(popup.getByText("Günlük skor")).toBeVisible();
    await popup.close();
  });

  test("should switch back to Durum tab", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByText("Skor").click();
    await expect(popup.getByText("Günlük skor")).toBeVisible();
    // Durum tab linkine .first() ile tıkla — "Durum" baska yerde de
    // gecebilir (ornegin balon metni).
    await popup.getByText("Durum").first().click();
    // Sayac karti acik; .first() ile strict mode'dan kacin.
    await expect(popup.getByText("Kontrol Geçmişi").first()).toBeVisible({ timeout: 5000 });
    await popup.close();
  });

  // "Aktif/Pasif" toggle artik popup Header'inda degil, Options > Genel
  // Ayarlar sayfasindaki "Alparslan" SettingsToggle kartinda. Popup'a
  // yakinsa bagli iki testin ikisi de options-dashboard.spec.ts'ye
  // gecmesi gerekiyordu; kisa vadeli olarak burada skip'liyoruz ve
  // ilgili senaryoyu options-taban testler kapsiyor.
  test.skip("should show toggle switch in header", async () => {
    // Toggle popup'ta yok — Options > Alparslan kartinda role=switch.
  });

  test.skip("negative: should show disabled state when toggled off", async () => {
    // Disable eylemi artik Options tabli — popup navigation'da yeri yok.
  });
});
