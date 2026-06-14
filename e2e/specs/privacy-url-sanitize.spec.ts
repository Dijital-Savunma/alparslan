import { test, expect } from "../fixtures/extension";
import { navigateToSite, openOptionsPage } from "../helpers/extension-page";
import { clearHistory, getHistory } from "../helpers/extension-messaging";
import { routeExampleCom } from "../helpers/site-routes";

test.describe("Privacy URL sanitization", () => {
  test("stores scan history without query strings or fragments", async ({
    context,
    extensionId,
  }) => {
    await routeExampleCom(context);
    const options = await openOptionsPage(context, extensionId);
    await clearHistory(options);

    const page = await navigateToSite(
      context,
      "https://example.com/login?token=abc&secret=xyz#reset",
    );

    await expect.poll(async () => (await getHistory(options)).length).toBeGreaterThan(0);
    const history = await getHistory(options);
    expect(history.every((entry) => !entry.url.includes("?") && !entry.url.includes("#"))).toBe(
      true,
    );
    expect(history.some((entry) => entry.url === "https://example.com/login")).toBe(true);

    await page.close();
    await options.close();
  });
});
