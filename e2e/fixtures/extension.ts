import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Worker-scoped browser context: one Chromium + extension for all tests in
// the worker, instead of a fresh launch per test. With workers=1 this means
// a single launch for the entire suite — ~28× startup amortised into one.
// Tests that need isolation can still create their own pages via
// context.newPage() and close them at the end of the test.
export const test = base.extend<
  {
    context: BrowserContext;
    extensionId: string;
  },
  {
    _workerContext: BrowserContext;
    _workerExtensionId: string;
  }
>({
  // eslint-disable-next-line no-empty-pattern
  _workerContext: [async ({}, use) => {
    const extensionPath = path.resolve(__dirname, "../../dist");
    const ctx = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--disable-extensions-except=" + extensionPath,
        "--load-extension=" + extensionPath,
        "--no-first-run",
        "--disable-gpu",
      ],
    });
    await use(ctx);
    await ctx.close();
  }, { scope: "worker" }],

  _workerExtensionId: [async ({ _workerContext }, use) => {
    let serviceWorker = _workerContext.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await _workerContext.waitForEvent("serviceworker");
    }
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  }, { scope: "worker" }],

  // Per-test forwarding fixtures keep the existing test signatures working.
  context: async ({ _workerContext }, use) => {
    await use(_workerContext);
  },
  extensionId: async ({ _workerExtensionId }, use) => {
    await use(_workerExtensionId);
  },
});

export { expect } from "@playwright/test";
