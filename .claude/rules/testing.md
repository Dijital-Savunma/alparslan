# Testing

Two layers. A detection-logic or security-invariant change without a matching
test is incomplete.

## Unit (Vitest) — `tests/`

Mirrors `src/`. Run:
```bash
npm test            # vitest run
npm run test:watch  # watch mode
```

Densest coverage lives in `tests/detector/` (`url-checker.test.ts`,
`typosquatting-deep.test.ts`, `detection-effectiveness.test.ts`,
`page-analyzer.test.ts`), plus `storage/`, `network/`, `blocklist/`,
`background/` (message handlers + privilege checks), and
`utils/whitelist-normalize.test.ts`.

When adding a detection case, follow the existing table-driven style in
`typosquatting-deep.test.ts`. See the
[write-detector-test](../skills/write-detector-test/SKILL.md) skill.

> Note: the suite currently emits a few non-fatal "unhandled errors" from a
> transitive test-env dependency (`html-encoding-sniffer` → `@exodus/bytes`
> ESM/CJS). They fail no tests and are unrelated to app code.

## E2E (Playwright) — `e2e/specs/`

```bash
npm run test:e2e          # headless:false fixture; runs against the built dist/
npm run test:e2e:headed   # visible browser
npm run test:e2e:debug
```

The fixture (`e2e/fixtures/extension.ts`):
- loads the **built** extension from `dist/` (run a build first if stale),
- **stubs the GitHub list fetches** (`**/AsabiAlgo/blocklists/**`) so tests are
  deterministic and offline,
- waits on the `__alparslanE2E` readiness flags (`swInitDone`, `blocklistLoaded`,
  `breachLoaded`) before the test body runs.

Detection assertions go through the real background pipeline via
`chrome.runtime.sendMessage({ type: "CHECK_URL", url })`. Keep the
false-positive regression guards green (e.g. `ntv.com.tr`,
`login.microsoftonline.com` must NOT be flagged).

## Before opening a PR

`npm test`, `npm run lint`, and a clean `npm run build` (which type-checks).
Run `npm run test:e2e` when you changed detection, messaging, or UI.
