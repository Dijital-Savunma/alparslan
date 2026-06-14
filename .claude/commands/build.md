---
description: Build and package all three browser targets, then verify versions match
---

Build and package the extension for all targets, then verify the artifacts.

1. Run the three builds (each runs `tsc --noEmit` first):
   - `npm run build` → `dist/` (Chrome MV3)
   - `npm run build:firefox` → `dist-firefox/` (Firefox MV2)
   - `npm run build:safari` → `dist-safari/` (Safari MV3)
2. Package each: `npm run package`, `npm run package:firefox`, `npm run package:safari`.
3. Verify the version in `package.json` matches `"version"` in the built
   `dist/manifest.json`, `dist-firefox/manifest.json`, and `dist-safari/manifest.json`.
   Report any mismatch — all four must agree.
4. Confirm each `.zip` is non-empty and lists `manifest.json` at its root.

Report a concise pass/fail summary with the resolved version and any errors.
