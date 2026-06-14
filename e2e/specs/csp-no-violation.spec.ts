import { test, expect } from "../fixtures/extension";

test.describe("Extension page CSP", () => {
  test("popup and options do not emit CSP/refused-script errors", async ({
    context,
    extensionId,
  }) => {
    for (const path of ["popup.html", "options.html"]) {
      const page = await context.newPage();
      const errors: string[] = [];

      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        const text = message.text();
        if (/content security policy|refused to execute|refused to load/i.test(text)) {
          errors.push(text);
        }
      });

      await page.goto(`chrome-extension://${extensionId}/${path}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).toBeVisible();
      await page.waitForTimeout(1000);
      expect(errors).toEqual([]);
      await page.close();
    }
  });
});
