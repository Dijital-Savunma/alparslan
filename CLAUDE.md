# CLAUDE.md — Alparslan

Guidance for Claude Code (and any AI agent) working in this repository. Human
contributors should read `CONTRIBUTING.md`; this file is the machine-facing
companion that captures the architecture, conventions, and security invariants
that must not be regressed.

## What this is

**Alparslan** is a cross-browser **Manifest V3** extension that protects users
from phishing and scam websites, with a focus on threats targeting Turkey. All
detection runs **client-side** — browsing data never leaves the device. Ships
for Chrome/Chromium (MV3), Firefox (MV2), and Safari (MV3).

- **Language:** TypeScript. **UI:** React 18. **Build:** Vite 5.
- **Tests:** Vitest (unit) + Playwright (E2E).
- **Lint/format:** ESLint + Prettier.

> Code, identifiers, comments, and docs are written in **English**.
> User-facing UI strings are **Turkish** (see `_locales/tr/` and `src/i18n/tr.ts`).

## Commands

```bash
npm install              # install deps (use `npm ci` for a clean, lockfile-exact install)
npm run dev              # vite build --watch (development)

npm test                 # vitest run (unit)
npm run test:watch       # vitest watch
npm run lint             # eslint src/
npm run format           # prettier --write src/

npm run build            # Chrome build  -> dist/
npm run build:firefox    # Firefox build -> dist-firefox/
npm run build:safari     # Safari build  -> dist-safari/

npm run package          # build + zip   -> dist.zip
npm run package:firefox  # build + zip   -> dist-firefox.zip
npm run package:safari   # build + zip   -> dist-safari.zip

npm run test:e2e         # playwright (loads the built extension via a fixture)
npm run test:e2e:headed  # with a visible browser
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.

## Architecture

Service-worker-centric. The background worker orchestrates detection; content
scripts render warnings; popup/options are React apps.

```
src/
├── background/   Service worker (MV3) / background script (MV2). Message hub + orchestration.
├── content/      Injected page script: warning banner (Shadow DOM), SPA URL tracking, page analysis.
├── popup/        React popup (badge status, history, URL check, whitelist UI, dashboard).
├── options/      React options/settings page.
├── detector/     Detection engine:
│                   url-checker.ts    URL heuristics: homoglyph + digit-confusable, typosquatting,
│                                     Damerau-Levenshtein, subdomain hiding, IP/TLD checks, punycode decode.
│                   page-analyzer.ts  Page-content heuristics: login/CC forms, external form actions,
│                                     TC Kimlik patterns, urgency language.
├── blocklist/    Threat data:
│                   bloom-filter.ts     FNV-1a Bloom filter (fast USOM membership test).
│                   indexeddb-store.ts  USOM domains persisted in IndexedDB (confirmation lookups).
│                   updater.ts          Remote blocklist fetch + scheduling (chrome.alarms).
│                   usom-updater.ts     Turkish CERT (USOM) list: fetch, integrity-verify, build Bloom.
│                   whitelist-updater.ts Dynamic allowlist + UGC domains + risky TLDs.
├── network/      Request layer:
│                   dnr-manager.ts      declarativeNetRequest block rules (Chrome/Safari MV3).
│                   request-monitor.ts  webRequest monitoring + per-tab stats (Firefox blocking path).
│                   url-check-cache.ts  In-memory TTL cache of heuristic results.
├── storage/      idb.ts (IndexedDB), list-cache.ts (in-memory whitelist/blacklist Sets w/ parent-domain match).
├── breach/       Local breach-DB lookup.
├── dashboard/    Metrics + risk-score calculation for the popup dashboard.
├── privacy/      Tracker-blocking rules.
└── utils/        browser-polyfill, safe-fetch (size/timeout caps), whitelist-normalize, logger, types.
```

### Detection data flow (navigate → block/warn)

1. `chrome.tabs.onUpdated` (main_frame complete) → `background/index.ts`.
2. **Allowlist short-circuit:** `isWhitelisted(host)` (exact + up to 3 parent
   domains) → returns SAFE immediately, no further checks.
3. `checkUrlConfirmed(url, protectionLevel)`:
   - **Blacklist** (`isBlacklisted`) and **USOM Bloom** (`usomBloomTest`) →
     DANGEROUS (early return). A USOM hit is **confirmed** against IndexedDB to
     drop Bloom false positives.
   - **Dynamic whitelist** → SAFE (early return).
   - Protection `low` → blocklist only; `medium`/`high` add heuristics
     (`high` lowers the DANGEROUS/SUSPICIOUS thresholds).
   - `checkTyposquatting` → punycode decode → homoglyph + digit-letter
     normalization → exact/edit-distance/substring/subdomain-hiding checks
     against `TRUSTED_DOMAINS`.
4. Badge updated (✓/!/?), and if DANGEROUS/SUSPICIOUS with DOM warnings enabled,
   `SHOW_WARNING` is sent to the content script, which renders a Shadow-DOM banner.

## Security invariants — DO NOT REGRESS

These were added/hardened deliberately. Changing detection or messaging code
must preserve them; add a test when you touch the area.

- **Privileged-message sender verification** (`background/index.ts`,
  `isFromExtensionPage`): `SET_ENABLED`, `SETTINGS_UPDATED`, `ADD_TO_WHITELIST`,
  `REMOVE_FROM_WHITELIST`, `CLEAR_HISTORY` are rejected unless they come from an
  extension page (same `runtime.id`, extension-origin URL). Content scripts
  cannot invoke them.
- **Allowlist guards:** user input goes through `utils/whitelist-normalize.ts`
  (strip protocol/path/query/port, reject single-label and public-suffix
  entries). The dynamic-whitelist parser (`whitelist-updater.ts`) also rejects
  public suffixes (`com`, `com.tr`, `gov.tr`, …) so a poisoned list can't
  whitelist a whole TLD, and rejects a new list that shrank >50% (corruption/attack).
- **USOM integrity** (`usom-updater.ts` `verifyIntegrity`): upstream SHA-256
  strict match when present; locally-stored hash for the same version tag detects
  mid-flight tampering; update aborts (previous list retained) on mismatch.
- **URL sanitization before storage** (`sanitizeUrlForStorage`): drop query +
  fragment before persisting history/reports — never leak tokens/OAuth codes.
- **Fetch caps** (`utils/safe-fetch.ts`): per-source size + timeout limits on all
  remote list fetches.
- **Report rate limit:** `REPORT_SITE` capped at 10/hour.
- **Logging PII contract:** log message *types*, not URLs/sender URLs, outside
  debug mode.

Security disclosures go to **guvenlik@dijitalsavunma.org** — never a public issue.

## Build system (vite.config.ts)

One config, multiple `--mode`s. Each produces a platform output dir; a build
plugin copies the matching manifest (`manifest.json` / `.firefox.json` /
`.safari.json`), `lists/`, `_locales/`, `icons/`, and the hand-written
`list.html/js` + `whitelist.html/js` pages into the output.

| Output | Modes |
|--------|-------|
| `dist/` (Chrome MV3) | default + `content` (content script as IIFE) |
| `dist-firefox/` (Firefox MV2) | `firefox` + `firefox-bg` + `firefox-content` |
| `dist-safari/` (Safari MV3) | `safari` + `safari-content` |

Root-level `background.js`/`content.js`/`popup.js`/`options.js`/`chunks/` are
**build output** and are git-ignored — never commit them; they must live in `dist/`.

## Testing

- **Unit (Vitest)** in `tests/`, mirroring `src/`. The detector has the densest
  coverage (`tests/detector/*`), plus storage, network, blocklist, background
  message handlers, and `utils/whitelist-normalize`. Add/adjust a test for any
  detection or security-invariant change.
- **E2E (Playwright)** in `e2e/specs/`. A fixture (`e2e/fixtures/extension.ts`)
  loads the built extension, waits on `__alparslanE2E` readiness flags
  (`swInitDone`, `blocklistLoaded`, `breachLoaded`), and **stubs the GitHub list
  fetches** so tests are deterministic and offline.

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) —
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Reference PRs/issues
  (`#31`, `Closes #123`).
- **Branches:** `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`
  (`chore/…` for tooling, `release/vX.Y.Z` for release prep).
- **Style:** ESLint + Prettier (`semi: true`, double quotes, 2-space, trailing
  commas, width 100). Run `npm run lint` and `npm run format` before committing.
- **PRs:** rebase on `main`, tests + lint green, CI passing, ≥1 review.

## Release process

The version lives in **four** files that must move in lockstep:
`package.json`, `manifest.json`, `manifest.firefox.json`, `manifest.safari.json`.

1. Bump all four (`/release-prep` automates this), `chore(release): bump version X → Y`.
2. Merge to `main`, tag `vX.Y.Z`, and **publish a GitHub Release**. The release
   is the trigger: `.github/workflows/release.yml` runs tests, builds all three
   targets, and attaches `alparslan-{chrome,firefox,safari}-vX.Y.Z.zip` to the release.
3. **Store submission is manual** (no automation, no credentials in repo):
   - Chrome Web Store → upload `dist.zip` / the chrome release asset.
   - Firefox AMO → upload the firefox zip.
   - Safari → `xcrun safari-web-extension-converter dist-safari/ …` then Xcode (see README).

## Gotchas

- Don't commit build output to the repo root — it belongs in `dist*/`.
- USOM/whitelist data loads asynchronously; the worker gates `CHECK_URL` on list
  readiness. When testing detection, wait for readiness (E2E uses `__alparslanE2E`).
- Firefox (MV2) blocks via `webRequest` (not DNR); the DNR manager no-ops there.
- Short trusted names (≤4 chars) skip edit-distance checks by design (false-positive control).
