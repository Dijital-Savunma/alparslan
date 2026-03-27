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

function copyExtensionFiles(isFirefox: boolean) {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const dist = resolve(__dirname, isFirefox ? "dist-firefox" : "dist");

      // Copy the appropriate manifest
      const manifestSrc = isFirefox ? "manifest.firefox.json" : "manifest.json";
      copyFileSync(resolve(__dirname, manifestSrc), resolve(dist, "manifest.json"));

      // Copy lists/
      copyDir(resolve(__dirname, "lists"), resolve(dist, "lists"));

      // Copy _locales/
      copyDir(resolve(__dirname, "public/_locales"), resolve(dist, "_locales"));

      // Copy icons/ (if exists)
      copyDir(resolve(__dirname, "icons"), resolve(dist, "icons"));
    },
  };
}

export default defineConfig(({ mode }) => {
  const isFirefox = mode === "firefox";
  return {
    plugins: [react(), copyExtensionFiles(isFirefox)],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
    build: {
      outDir: isFirefox ? "dist-firefox" : "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
          options: resolve(__dirname, "options.html"),
          background: resolve(__dirname, "src/background/index.ts"),
          content: resolve(__dirname, "src/content/index.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: isFirefox ? "chunks/[name].js" : "chunks/[name].[hash].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
  };
});
