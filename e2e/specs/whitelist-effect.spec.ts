import { test, expect } from "../fixtures/extension";
import { openOptionsPage } from "../helpers/extension-page";
import { checkUrl, getListStats } from "../helpers/extension-messaging";

test.describe("Whitelist effect", () => {
  test("added domain increases SW whitelist stats and short-circuits CHECK_URL to SAFE", async ({
    context,
    extensionId,
  }) => {
    const options = await openOptionsPage(context, extensionId);
    const before = await getListStats(options);

    // Options default section artik "Genel Ayarlar" — whitelist input'una
    // erisebilmek icin sidebar'da "Güvendiğim Bağlantılar" sekmesine gec.
    await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
    // Sayfada birden fazla textbox olabilecegi icin placeholder ile
    // hedef alaniyla dogrudan konusalim.
    await options.getByPlaceholder(/istisna|adresini girin|example\.com/i).fill("hgs.simple-url.com");
    await options.getByRole("button", { name: "Ekle" }).click();
    await expect(options.getByText("hgs.simple-url.com", { exact: true })).toBeVisible();

    await expect
      .poll(async () => (await getListStats(options)).whitelistSize)
      .toBeGreaterThan(before.whitelistSize);

    const result = await checkUrl(options, "https://hgs.simple-url.com/login");
    expect(result.level).toBe("SAFE");

    await options.close();
  });

  // Regression for the banner/popup contradiction: a domain the heuristics flag
  // must flip to SAFE once whitelisted, through the same verdict path the badge
  // and warning banner now use (evaluateTab -> whitelist short-circuit). Before
  // the fix, a whitelisted-but-flagged site still produced a danger banner.
  test("a heuristically-flagged domain becomes SAFE once whitelisted", async ({
    context,
    extensionId,
  }) => {
    const options = await openOptionsPage(context, extensionId);
    const flagged = "https://isbenk.com.tr/login"; // typosquat of isbank → flagged

    const before = await checkUrl(options, flagged);
    expect(["DANGEROUS", "SUSPICIOUS"]).toContain(before.level);

    // Sidebar'da whitelist sekmesine gec + placeholder ile input hedefle.
    await options.getByRole("button", { name: "Güvendiğim Bağlantılar", exact: true }).click();
    await options.getByPlaceholder(/istisna|adresini girin|example\.com/i).fill("isbenk.com.tr");
    await options.getByRole("button", { name: "Ekle" }).click();
    await expect(options.getByText("isbenk.com.tr", { exact: true })).toBeVisible();

    await expect
      .poll(async () => (await checkUrl(options, flagged)).level)
      .toBe("SAFE");

    await options.close();
  });
});
