---
name: verify-security-invariants
description: Audit a code change (a diff, a PR, or staged work) against Alparslan's documented security invariants before merge. Use when reviewing or finishing changes that touch detection, allowlist/blocklist, background messaging, storage, or remote fetches.
model: inherit
---

# Verify Security Invariants

Check that a change does not weaken any protection in
`.claude/rules/security-invariants.md`. Read-only analysis — report findings, fix
only if asked.

## Steps

1. **Get the diff:** `git diff main...HEAD` (or the staged diff). Note which
   areas it touches: `background/`, `detector/`, `blocklist/`, `network/`,
   `storage/`, `utils/safe-fetch.ts`, `utils/whitelist-normalize.ts`.

2. **Run the checklist** against the changed code:
   - **Sender verification** — did a new mutating message type get added without
     being included in the privileged set guarded by `isFromExtensionPage`?
   - **Allowlist guards** — does new allowlist handling still reject public
     suffixes and single-label entries, and keep the >50%-shrink rejection?
   - **USOM integrity** — is `verifyIntegrity()` still on the update path; can a
     fetched list be applied without a hash check?
   - **URL sanitization** — is any full URL (with query/fragment) now persisted to
     storage/history/reports without `sanitizeUrlForStorage()`?
   - **Bounded fetches** — does any new remote fetch bypass `utils/safe-fetch.ts`
     size/timeout caps?
   - **Rate limiting** — is a new user-triggered, abuse-prone message uncapped?
   - **Logging PII** — does new logging emit URLs / `sender.url` outside debug?

3. **Check test coverage** — for each weakened-or-changed invariant, is there a
   test locking the intended behavior? Flag missing ones.

4. **Report**: per invariant → `OK` / `AT RISK` (with file + reason) / `N/A`.
   Lead with anything AT RISK. Recommend the smallest fix + the test to add.

## Done when

Every invariant is `OK` or `N/A`, or the AT-RISK items are clearly reported with
a recommended fix and test.
