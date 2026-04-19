import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "fs";

function copyDir(src: string, dest: string) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

type Platform = "chrome" | "firefox" | "safari";

function copyExtensionFiles(platform: Platform) {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const distMap: Record<Platform, string> = { chrome: "dist", firefox: "dist-firefox", safari: "dist-safari" };
      const dist = resolve(__dirname, distMap[platform]);
      const manifestMap: Record<Platform, string> = {
        chrome: "manifest.json",
        firefox: "manifest.firefox.json",
        safari: "manifest.safari.json",
      };

      copyFileSync(resolve(__dirname, manifestMap[platform]), resolve(dist, "manifest.json"));
      copyDir(resolve(__dirname, "lists"), resolve(dist, "lists"));
      copyDir(resolve(__dirname, "public/_locales"), resolve(dist, "_locales"));
      copyDir(resolve(__dirname, "icons"), resolve(dist, "icons"));
    },
  };
}

// IIFE build for scripts that can't use ES module imports:
// - Content scripts (all browsers: loaded as classic scripts)
// - Firefox MV2 background script (no type:module support)
function iifeBuild(entry: string, outFile: string, outDir: string) {
  return {
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: {
      outDir,
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, entry),
        output: {
          format: "iife" as const,
          entryFileNames: outFile,
        },
      },
    },
  };
}

// ESM build for popup + options + background (Chrome MV3 / Safari MV3)
function esmBuild(platform: Platform) {
  const distMap: Record<Platform, string> = { chrome: "dist", firefox: "dist-firefox", safari: "dist-safari" };
  const dist = distMap[platform];
  const useHash = platform === "chrome"; // Safari doesn't like hashed chunk names

  return {
    plugins: [react(), copyExtensionFiles(platform)],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: {
      outDir: dist,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
          options: resolve(__dirname, "options.html"),
          background: resolve(__dirname, "src/background/index.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: useHash ? "chunks/[name].[hash].js" : "chunks/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // IIFE builds — single-entry, all deps inlined, no import statements
  if (mode === "content")         return iifeBuild("src/content/index.ts", "content.js", "dist");
  if (mode === "firefox-content") return iifeBuild("src/content/index.ts", "content.js", "dist-firefox");
  if (mode === "firefox-bg")      return iifeBuild("src/background/index.ts", "background.js", "dist-firefox");
  if (mode === "safari-content")  return iifeBuild("src/content/index.ts", "content.js", "dist-safari");

  // Firefox main build: popup + options only (bg built separately as IIFE)
  if (mode === "firefox") {
    return {
      plugins: [react(), copyExtensionFiles("firefox")],
      resolve: { alias: { "@": resolve(__dirname, "src") } },
      build: {
        outDir: "dist-firefox",
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, "popup.html"),
            options: resolve(__dirname, "options.html"),
          },
          output: {
            entryFileNames: "[name].js",
            chunkFileNames: "chunks/[name].js",
            assetFileNames: "assets/[name].[ext]",
          },
        },
      },
    };
  }

  // Safari build: same as Chrome (MV3, ESM background + IIFE content)
  if (mode === "safari") return esmBuild("safari");

  // Chrome build (default)
  return esmBuild("chrome");
});
