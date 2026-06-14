# Release

## Version lives in four files — keep them in lockstep

- `package.json`
- `manifest.json` (Chrome MV3)
- `manifest.firefox.json` (Firefox MV2)
- `manifest.safari.json` (Safari MV3)

All four must always show the same version. The `/release-prep` command and the
[release skill below] automate the bump and verification.

## Steps

1. **Bump** all four files; commit `chore(release): bump version <old> → <new>`.
   Verify the built `dist/manifest.json` shows the new version.
2. **Merge** to `main`, then **publish a GitHub Release** tagged `vX.Y.Z`.
   - The release (event: `published`) triggers `.github/workflows/release.yml`,
     which runs tests, builds all three targets, and attaches
     `alparslan-{chrome,firefox,safari}-vX.Y.Z.zip` to the release.
3. **Store submission is manual** — no automation, no credentials in the repo:
   - **Chrome Web Store** → upload the chrome zip.
   - **Firefox AMO** → upload the firefox zip.
   - **Safari** → `xcrun safari-web-extension-converter dist-safari/ …`, then
     build in Xcode (see `README.md`).

## Don't

- Don't bump only some of the four files.
- Don't commit build output (`dist*/`, root `*.js`, `*.zip`) — it's git-ignored.
- Don't expect the GitHub Release to publish to the stores; that step is human.
