// Phase 3 — Live UX verification
// Sends CHECK_URL messages from the options page (extension-context) to the
// background service worker. Each test creates its own page to avoid
// cross-test SW lifetime issues.

import { test, expect } from "../fixtures/extension";
import type { Page, BrowserContext } from "@playwright/test";

interface CheckUrlResult {
  level: "SAFE" | "SUSPICIOUS" | "DANGEROUS" | "UNKNOWN";
  score: number;
  reasons: string[];
}

async function openExtensionContextPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

async function checkUrlLive(page: Page, url: string): Promise<CheckUrlResult> {
  return page.evaluate(
    (u) =>
      new Promise<CheckUrlResult>((resolve) => {
        chrome.runtime.sendMessage({ type: "CHECK_URL", url: u }, (res: CheckUrlResult) => resolve(res));
      }),
    url,
  );
}

test.describe("Phase 3 — Live detection through background SW", () => {
  test("typosquat flagged via live SW", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    const result = await checkUrlLive(page, "https://garanti.com.t/giris");
    expect(["DANGEROUS", "SUSPICIOUS"]).toContain(result.level);
    await page.close();
  });

  test("Cyrillic homoglyph still flagged via live SW", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    // Latin 'a' in akbank replaced with Cyrillic 'а' (U+0430).
    // After the short-name distance tightening (#20), this may come
    // through as SUSPICIOUS rather than DANGEROUS — the invariant we
    // care about is "still flagged", not the specific severity.
    const result = await checkUrlLive(page, "https://\u0430kbank.com.tr/");
    expect(["DANGEROUS", "SUSPICIOUS"]).toContain(result.level);
    await page.close();
  });

  test("IP URL flagged via live SW", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    const result = await checkUrlLive(page, "http://185.34.56.78/login");
    expect(["DANGEROUS", "SUSPICIOUS"]).toContain(result.level);
    await page.close();
  });

  test("google.com.tr SAFE/UNKNOWN via live SW", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    const result = await checkUrlLive(page, "https://www.google.com.tr/search?q=test");
    expect(["SAFE", "UNKNOWN"]).toContain(result.level);
    await page.close();
  });

  test("FP REGRESSION #20: ntv.com.tr NOT DANGEROUS", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    const result = await checkUrlLive(page, "https://www.ntv.com.tr/");
    test.info().annotations.push({
      type: "known-issue-20",
      description: `${result.level} (${result.reasons.join("; ")})`,
    });
    expect(result.level).not.toBe("DANGEROUS");
    await page.close();
  });

  test("FP REGRESSION #21: login.microsoftonline.com NOT DANGEROUS", async ({ context, extensionId }) => {
    const page = await openExtensionContextPage(context, extensionId);
    const result = await checkUrlLive(page, "https://login.microsoftonline.com/");
    test.info().annotations.push({
      type: "known-issue-21",
      description: `${result.level} (${result.reasons.join("; ")})`,
    });
    expect(result.level).not.toBe("DANGEROUS");
    await page.close();
  });
});

test.describe("Phase 3 — Extension UI loads", () => {
  test("popup renders without JS errors", async ({ context, extensionId }) => {
    const p = await context.newPage();
    const errors: string[] = [];
    p.on("pageerror", (err) => errors.push(err.message));
    await p.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(p.locator("body")).toBeVisible();
    await p.waitForTimeout(1500);
    expect(errors).toHaveLength(0);
    await p.close();
  });

  test("options renders without JS errors", async ({ context, extensionId }) => {
    const p = await context.newPage();
    const errors: string[] = [];
    p.on("pageerror", (err) => errors.push(err.message));
    await p.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(p.locator("body")).toBeVisible();
    await p.waitForTimeout(1500);
    expect(errors).toHaveLength(0);
    await p.close();
  });
});
