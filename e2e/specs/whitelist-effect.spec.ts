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

    await options.getByRole("textbox").fill("hgs.simple-url.com");
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

    await options.getByRole("textbox").fill("isbenk.com.tr");
    await options.getByRole("button", { name: "Ekle" }).click();
    await expect(options.getByText("isbenk.com.tr", { exact: true })).toBeVisible();

    await expect
      .poll(async () => (await checkUrl(options, flagged)).level)
      .toBe("SAFE");

    await options.close();
  });
});
