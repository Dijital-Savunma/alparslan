# Code Style

## Language & tooling

- **TypeScript** throughout. **React 18** for popup/options UI. **Vite 5** build.
- **ESLint + Prettier** are configured and enforced. Run before committing:
  ```bash
  npm run lint      # eslint src/
  npm run format    # prettier --write src/
  ```

## Prettier

`semi: true`, **double quotes** (`singleQuote: false`), 2-space indent,
`trailingComma: all`, `printWidth: 100`.

## ESLint

Extends `eslint:recommended`, `@typescript-eslint/recommended`, `prettier`.
- `no-unused-vars`: error, but names prefixed with `_` are ignored.
- `no-console`: warn — `console.log` / `console.error` are allowed; avoid others.
- Env: `browser`, `es2020`, `webextensions`.

## Conventions

- **English** for all code, identifiers, comments, and docs.
- **Turkish** for user-facing strings — add them to `_locales/tr/messages.json`
  (manifest `__MSG_*` keys) and `src/i18n/tr.ts`, never hardcode UI text.
- Booleans read as predicates: `is*` / `has*` / `can*`.
- Keep modules single-purpose; the existing `src/` layout (one concern per dir)
  is the pattern to follow.
- Prefer pure, testable functions in `detector/` and `utils/` — they carry the
  densest unit coverage and the security-sensitive logic.

## Commits & branches

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`. Reference PRs/issues (`#31`, `Closes #123`).
- Branch prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/` (`chore/` for
  tooling, `release/vX.Y.Z` for release prep).
- Do not add `Co-Authored-By` / tool-attribution trailers to commits.
