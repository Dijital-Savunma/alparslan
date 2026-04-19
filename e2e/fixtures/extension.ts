import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, "../../dist");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--disable-extensions-except=" + extensionPath,
        "--load-extension=" + extensionPath,
        "--no-first-run",
        "--disable-gpu",
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    const extensionId = serviceWorker.url().split("/")[2];

    // Wait for the SW to finish its init (USOM + whitelist + breach cache)
    // AND for onInstalled to finish loading the built-in blocklist + breach
    // DB into IndexedDB. Without this, the first test races with the
    // SW's async init: popup opens in "loading" state, content-script
    // breach checks return empty, and assertions time out.
    //
    // Flags are set by src/background/index.ts. 30 s ceiling because USOM
    // fetch from GitHub is the slowest step and can take 10-15 s on CI.
    await serviceWorker.evaluate(async () => {
      interface E2EReadiness {
        swInitDone: boolean;
        blocklistLoaded: boolean;
        breachLoaded: boolean;
      }
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const s = (globalThis as typeof globalThis & { __alparslanE2E?: E2EReadiness }).__alparslanE2E;
        if (s?.swInitDone && s?.blocklistLoaded && s?.breachLoaded) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error("extension service worker did not become ready within 30 s");
    });

    await use(extensionId);
  },
});

export { expect } from "@playwright/test";
