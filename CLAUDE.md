# CLAUDE.md — Alparslan

Guidance for Claude Code (and any AI agent) working in this repo. Humans should
read `CONTRIBUTING.md`; this is the machine-facing companion. The detailed,
modular rules live under `.claude/rules/` and are imported below.

## What this is

**Alparslan** — a cross-browser **Manifest V3** anti-phishing extension
(TypeScript + React 18 + Vite 5), focused on threats targeting Turkey. All
detection runs **client-side**. Ships for Chrome (MV3), Firefox (MV2), Safari (MV3).

> Code/identifiers/comments/docs: **English**. User-facing UI strings: **Turkish**.

## Commands

```bash
npm install              # deps (npm ci for a clean, lockfile-exact install)
npm run dev              # vite build --watch
npm test                 # vitest (unit)
npm run lint             # eslint src/
npm run format           # prettier --write src/
npm run build            # Chrome  -> dist/        (runs tsc --noEmit first)
npm run build:firefox    # Firefox -> dist-firefox/
npm run build:safari     # Safari  -> dist-safari/
npm run package[:firefox|:safari]   # build + zip
npm run test:e2e         # playwright (loads the built extension)
```

## Rules (imported)

@.claude/rules/principles.md
@.claude/rules/architecture.md
@.claude/rules/code-style.md
@.claude/rules/security-invariants.md
@.claude/rules/testing.md
@.claude/rules/release.md

## Skills & agents

On-demand helpers under `.claude/`:

- **Skills** (`.claude/skills/`): `add-trusted-domain`, `write-detector-test`,
  `verify-security-invariants`.
- **Agents** (`.claude/agents/`): `detection-reviewer` — reviews detector/network
  changes against the security invariants.
- **Commands** (`.claude/commands/`): `/build`, `/test`, `/release-prep`.

## The one rule that matters most

This is security software. Never regress a documented **security invariant**
(`.claude/rules/security-invariants.md`), and never weaken detection, allowlist,
or blocking without a test that proves the new behavior. When in doubt, choose
the safer default and ask.
