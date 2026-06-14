---
description: Bump the version across all four files in lockstep, then verify
argument-hint: <new-version, e.g. 0.5.0>
---

Prepare a release by bumping the version to **$ARGUMENTS** (semver, no leading `v`).

The version lives in **four** files that must always agree:

- `package.json`
- `manifest.json` (Chrome MV3)
- `manifest.firefox.json` (Firefox MV2)
- `manifest.safari.json` (Safari MV3)

Steps:

1. Read the current version from `package.json`. Confirm `$ARGUMENTS` is a valid
   forward bump (greater than current). If no argument was given, ask for the
   target version — do not guess.
2. Update the `"version"` field in all four files to `$ARGUMENTS`.
3. `npm test` and `npm run build` (chrome) to confirm a clean build + green tests.
4. Verify the built `dist/manifest.json` shows `$ARGUMENTS`.
5. Show the diff and stop. **Do not commit, tag, push, or publish** — the human
   confirms, then commits as `chore(release): bump version <old> → $ARGUMENTS`.

After merge, the release is cut by publishing a GitHub Release tagged
`v$ARGUMENTS`, which triggers `.github/workflows/release.yml` to build and attach
the store zips. Store upload remains manual (see CLAUDE.md → Release process).
