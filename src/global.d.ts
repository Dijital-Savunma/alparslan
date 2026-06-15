/// <reference types="chrome" />

// Vite raw-string import — for files we want to embed directly in the
// bundle as text (no fetch, no separate asset). Used to inline the SVG
// logo in content-script banners so it renders even on pages with
// strict img-src CSPs that would block chrome-extension:// resources.
declare module "*.svg?raw" {
  const content: string;
  export default content;
}
