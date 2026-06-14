# Architecture

Alparslan is a cross-browser **Manifest V3** anti-phishing extension
(TypeScript + React 18 + Vite 5), focused on threats targeting Turkey. All
detection is **client-side** — browsing data never leaves the device. Ships for
Chrome/Chromium (MV3), Firefox (MV2), and Safari (MV3).

## Module map

```
src/
├── background/   Service worker (MV3) / background script (MV2). Message hub + orchestration.
│                 Verifies privileged-message senders; gates CHECK_URL on list readiness.
├── content/      Injected page script: Shadow-DOM warning banner, SPA URL tracking, page analysis.
├── popup/        React popup (status badge, history, URL check, whitelist UI, dashboard).
├── options/      React options/settings page.
├── detector/     Detection engine:
│                   url-checker.ts    URL heuristics: homoglyph + digit-letter confusables,
│                                     typosquatting, Damerau-Levenshtein, subdomain hiding,
│                                     IP / risky-TLD checks, punycode decode. TRUSTED_DOMAINS set.
│                   page-analyzer.ts  Page-content heuristics: login/CC forms, external form
│                                     actions, TC Kimlik patterns, urgency language.
├── blocklist/    Threat data:
│                   bloom-filter.ts      FNV-1a Bloom filter (fast USOM membership test).
│                   indexeddb-store.ts   USOM domains in IndexedDB (confirmation lookups).
│                   updater.ts           Remote blocklist fetch + scheduling (chrome.alarms).
│                   usom-updater.ts      Turkish CERT (USOM) list: fetch, integrity-verify, Bloom.
│                   whitelist-updater.ts Dynamic allowlist + UGC domains + risky TLDs.
├── network/      Request layer:
│                   dnr-manager.ts       declarativeNetRequest block rules (Chrome/Safari MV3).
│                   request-monitor.ts   webRequest monitoring + per-tab stats (Firefox path).
│                   url-check-cache.ts   In-memory TTL cache of heuristic results.
├── storage/      idb.ts (IndexedDB), list-cache.ts (in-memory whitelist/blacklist Sets w/ parent-domain match).
├── breach/       Local breach-DB lookup.
├── dashboard/    Metrics + risk-score for the popup dashboard.
├── privacy/      Tracker-blocking rules.
└── utils/        browser-polyfill, safe-fetch (size/timeout caps), whitelist-normalize, logger, types.
```

## Detection data flow (navigate → block/warn)

1. `chrome.tabs.onUpdated` (main_frame complete) → `background/index.ts`.
2. **Allowlist short-circuit:** `isWhitelisted(host)` (exact + up to 3 parent
   domains) → SAFE immediately, no further checks.
3. `checkUrlConfirmed(url, protectionLevel)`:
   - **Blacklist** (`isBlacklisted`) and **USOM Bloom** (`usomBloomTest`) →
     DANGEROUS (early return). A USOM hit is **confirmed** against IndexedDB to
     drop Bloom false positives.
   - **Dynamic whitelist** → SAFE (early return).
   - `low` protection → blocklist only; `medium`/`high` add heuristics
     (`high` lowers the DANGEROUS/SUSPICIOUS thresholds).
   - `checkTyposquatting` → punycode decode → homoglyph + digit-letter
     normalization → exact / edit-distance / substring / subdomain-hiding checks
     against `TRUSTED_DOMAINS`.
4. Badge updated (✓ / ! / ?), and on DANGEROUS/SUSPICIOUS with DOM warnings
   enabled, `SHOW_WARNING` → content script renders a Shadow-DOM banner.

## Build system (vite.config.ts)

One config, multiple `--mode`s. Each produces a platform output dir; a build
plugin copies the matching manifest (`manifest.json` / `.firefox.json` /
`.safari.json`), `lists/`, `_locales/`, `icons/`, and the hand-written
`list.html/js` + `whitelist.html/js` pages.

| Output | Modes |
|--------|-------|
| `dist/` (Chrome MV3) | default + `content` |
| `dist-firefox/` (Firefox MV2) | `firefox` + `firefox-bg` + `firefox-content` |
| `dist-safari/` (Safari MV3) | `safari` + `safari-content` |

Root-level `background.js` / `content.js` / `popup.js` / `options.js` / `chunks/`
are **build output** and are git-ignored — never commit them; they live in `dist/`.

## Gotchas

- USOM/whitelist data loads asynchronously; the worker gates `CHECK_URL` on
  readiness. When testing detection, wait for it (E2E uses `__alparslanE2E`).
- Firefox (MV2) blocks via `webRequest`, not DNR; the DNR manager no-ops there.
- Short trusted names (≤4 chars) skip edit-distance checks by design (FP control).
