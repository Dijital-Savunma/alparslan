# Security Invariants — DO NOT REGRESS

These protections were added/hardened deliberately. Any change to detection,
allowlist/blocklist, messaging, or remote-fetch code must preserve them. When you
touch one of these areas, add or update a test that locks the behavior in.

Use the [verify-security-invariants](../skills/verify-security-invariants/SKILL.md)
skill to audit a diff against this list.

## 1. Privileged-message sender verification
`background/index.ts` → `isFromExtensionPage(sender)`. The mutating messages
`SET_ENABLED`, `SETTINGS_UPDATED`, `ADD_TO_WHITELIST`, `REMOVE_FROM_WHITELIST`,
`CLEAR_HISTORY` are rejected unless they originate from an extension page (same
`runtime.id`, extension-origin URL). Content scripts must never be able to invoke
them. New mutating message types must be added to the privileged set.

## 2. Allowlist guards
- User input goes through `utils/whitelist-normalize.ts`: strip
  protocol/path/query/fragment/port; reject single-label entries and public
  suffixes (`com`, `com.tr`, `gov.tr`, …).
- The dynamic-whitelist parser (`whitelist-updater.ts`) independently rejects
  public suffixes, so a poisoned upstream list can't whitelist an entire TLD and
  bypass parent-domain matching.
- Reject a refreshed list that shrank by more than ~50% (corruption / attack).

## 3. USOM list integrity
`usom-updater.ts` → `verifyIntegrity()`: strict match against an upstream-published
SHA-256 when present; compare against the locally-stored hash for the same version
tag to detect mid-flight tampering; on mismatch, abort the update and keep the
previous list.

## 4. URL sanitization before storage
`sanitizeUrlForStorage()` drops query + fragment before anything is persisted
(history, reports). Never store full URLs — they leak tokens, OAuth codes, and
magic-link credentials.

## 5. Bounded remote fetches
`utils/safe-fetch.ts` enforces per-source size and timeout caps on every remote
list fetch. New remote sources must go through it with an explicit cap.

## 6. Rate limiting
`REPORT_SITE` is capped (10/hour). Keep abuse-prone, user-triggered messages
rate-limited.

## 7. Logging PII contract
Log message *types*, not URLs or `sender.url`, outside debug mode.

---

**Vulnerability disclosure:** email **guvenlik@dijitalsavunma.org** — never open a
public issue for a security bug (see `CONTRIBUTING.md`).
