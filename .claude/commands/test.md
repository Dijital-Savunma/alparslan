---
description: Run the unit suite (and optionally the E2E suite), then summarize
---

Run the project's tests and report results.

1. **Unit (always):** `npm test` (vitest). Report files/tests passed and any
   failures with the failing test names.
2. **Lint:** `npm run lint`. Report violations.
3. **E2E (only if the user asks, or when changing detection/UI/messaging):**
   `npm run test:e2e`. This builds and loads the extension via the Playwright
   fixture; it is slower and launches a browser. Use `npm run test:e2e:headed`
   when debugging.

When a detection rule, security invariant (see CLAUDE.md), or message handler
changed, a matching unit test must exist or be added — call out any gap.

Summarize: unit pass/fail counts, lint status, and (if run) E2E results.
