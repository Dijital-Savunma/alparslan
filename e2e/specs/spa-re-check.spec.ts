import { test, expect } from "../fixtures/extension";
import { navigateToSite, openOptionsPage } from "../helpers/extension-page";
import { clearHistory, getHistory } from "../helpers/extension-messaging";
import { routeExampleCom } from "../helpers/site-routes";

test.describe("SPA URL re-check", () => {
  test("re-runs content analysis after pushState URL changes", async ({ context, extensionId }) => {
    await routeExampleCom(context);
    const options = await openOptionsPage(context, extensionId);
    await clearHistory(options);

    const page = await navigateToSite(context, "https://example.com");
    await expect
      .poll(async () =>
        (await getHistory(options)).some((entry) => entry.url === "https://example.com/"),
      )
      .toBe(true);

    await page.evaluate(() => history.pushState({}, "", "/foo"));

    await expect
      .poll(
        async () =>
          (await getHistory(options)).some((entry) => entry.url === "https://example.com/foo"),
        {
          timeout: 4000,
        },
      )
      .toBe(true);

    await page.close();
    await options.close();
  });
});
