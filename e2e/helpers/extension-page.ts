import type { BrowserContext, Page } from "@playwright/test";

export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popupUrl = "chrome-extension://" + extensionId + "/popup.html";
  const page = await context.newPage();
  await page.goto(popupUrl);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function openOptionsPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const optionsUrl = "chrome-extension://" + extensionId + "/options.html";
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function navigateToSite(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
  return page;
}
