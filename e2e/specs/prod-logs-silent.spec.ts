import { test, expect } from "../fixtures/extension";
import { openOptionsPage } from "../helpers/extension-page";
import { checkUrl } from "../helpers/extension-messaging";

interface E2EReadiness {
  swInitDone: boolean;
  blocklistLoaded: boolean;
  breachLoaded: boolean;
}

test.describe("Production log gating", () => {
  // extensionId fixture KULLANILMIYOR: o fixture SW init bitene kadar bekler,
  // yani test body'ye girildiğinde init logları zaten üretilmiş olur.
  // Bunun yerine SW'yi burada yakalayıp listener'ı hemen ekliyoruz; ardından
  // init tamamlanana kadar biz bekliyoruz — böylece init sırasındaki loglar da
  // yakalanır.
  test(
    "does not emit Alparslan debug/info logs from the production service worker",
    async ({ context }) => {
      // 1. SW referansını mümkün olan en erken anda al
      const serviceWorker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent("serviceworker"));

      // 2. Listener'ı init beklenmeden hemen ekle
      const alparslanLogs: { type: string; text: string }[] = [];
      serviceWorker.on("console", (message) => {
        const text = message.text();
        if (text.includes("[Alparslan]")) {
          alparslanLogs.push({ type: message.type(), text });
        }
      });

      // 3. SW init'in tamamlanmasını bekle (extensionId fixture ile aynı mantık)
      await serviceWorker.evaluate(async () => {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const s = (
            globalThis as typeof globalThis & { __alparslanE2E?: E2EReadiness }
          ).__alparslanE2E;
          if (s?.swInitDone && s?.blocklistLoaded && s?.breachLoaded) return;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("extension service worker did not become ready within 60 s");
      });

      // 4. extensionId'yi SW URL'inden türet (fixture bağımlılığı olmadan)
      const extensionId = serviceWorker.url().split("/")[2];

      // 5. Asıl test: CHECK_URL sırasında da init sırasında da debug/info log yok
      const options = await openOptionsPage(context, extensionId);
      await checkUrl(options, "https://www.google.com.tr/search?q=prod-log-gate");
      await options.waitForTimeout(1000);

      expect(
        alparslanLogs.filter((log) => log.type === "debug" || log.type === "info"),
      ).toEqual([]);

      await options.close();
    },
  );
});
