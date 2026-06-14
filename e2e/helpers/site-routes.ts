import type { BrowserContext } from "@playwright/test";

const TEST_SITE_HTML = [
  "<!doctype html>",
  "<html>",
  "<head><title>Alparslan E2E</title></head>",
  "<body>",
  "<main>",
  "<h1>Alparslan E2E</h1>",
  "<p>Local fixture page for extension content-script checks.</p>",
  "</main>",
  "</body>",
  "</html>",
].join("");

async function routeStaticSite(context: BrowserContext, origin: string): Promise<void> {
  await context.route(`${origin}/**`, (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: TEST_SITE_HTML,
    }),
  );
}

export async function routeExampleCom(context: BrowserContext): Promise<void> {
  await routeStaticSite(context, "https://example.com");
}

export async function routeCommonSites(context: BrowserContext): Promise<void> {
  await Promise.all([
    routeStaticSite(context, "https://example.com"),
    routeStaticSite(context, "https://www.google.com"),
    routeStaticSite(context, "https://www.linkedin.com"),
  ]);
}
