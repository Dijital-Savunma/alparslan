# Principles

How agents (and contributors) should reason and work in this repository. These
apply to every task unless a more specific rule overrides them.

## 1. Think before coding

- State assumptions explicitly; if uncertain, stop and ask.
- If multiple interpretations exist, surface them — don't pick silently.
- If a simpler approach exists, say so.

## 2. Simplicity first (YAGNI)

- The minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code, no config that wasn't requested.

## 3. Surgical changes

- Touch only what the task requires. Match the existing style even if you'd do
  it differently. Don't refactor working code that's unrelated to the task.
- Remove only the imports/variables your own change orphaned.

## 4. Goal-driven, verified

- Turn tasks into verifiable goals: "add detection for X" → "write a failing
  test for X, then make it pass". Run `npm test` before claiming done.
- Never claim something works without evidence (test run / build / observed
  behavior). If tests weren't run, say so.

## 5. This is security software — be conservative

- A change to detection, allowlist, blocking, or messaging can weaken user
  protection. When in doubt, prefer the safer default and add a test.
- Never regress a documented security invariant (see [security-invariants.md](security-invariants.md)).

## 6. Communication

- Code, identifiers, comments, and docs are written in **English**.
- User-facing UI strings are **Turkish** (`_locales/tr/`, `src/i18n/tr.ts`).
- Respond to the user in their language; keep it concise and explicit.
