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
});
