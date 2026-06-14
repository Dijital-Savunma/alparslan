---
name: add-trusted-domain
description: Add a legitimate brand/domain to the detector's trusted set so typosquats, homoglyphs, and subdomain-hiding variants of it get flagged — with a regression test. Use when onboarding a new bank, gov service, retailer, or popular site that phishers impersonate.
model: inherit
---

# Add a Trusted Domain

Adding a brand to `TRUSTED_DOMAINS` is what makes its look-alikes (typosquats,
homoglyphs, digit-confusables, subdomain hiding) detectable. Do this carefully —
a wrong entry causes false positives on real sites.

## Steps

1. **Locate the sets** in `src/detector/url-checker.ts`:
   - `TRUSTED_DOMAINS` — the brands to protect (root domains, e.g. `garanti.com.tr`).
   - the brand-subdomains / legitimate-auxiliary set (e.g. `googleapis.com`,
     `microsoftonline.com`) — used to avoid flagging legit auxiliary domains.

2. **Add the domain** to `TRUSTED_DOMAINS` using its real root domain. For Turkish
   brands this is usually `name.com.tr`. Keep the list alphabetically grouped as
   the surrounding entries are.

3. **Watch the short-name rule:** names ≤4 chars skip edit-distance checks (FP
   control). If the brand name is short (e.g. `n11`, `bim`), confirm the
   digit-letter confusable path (`normalizeDigitLetterConfusables`) covers the
   realistic attack (e.g. `b1m`→`bim`) — add the case to the test below.

4. **Avoid false positives:** if the new brand's name is a common word or close to
   an existing trusted name, check it won't now flag legitimate sites. Add a
   "NOT flagged" regression case for any nearby legit domain.

5. **Add a regression test** (see the `write-detector-test` skill) in
   `tests/detector/typosquatting-deep.test.ts` (or `url-checker.test.ts`):
   - a look-alike of the new brand → expected SUSPICIOUS/DANGEROUS,
   - the real brand domain → expected SAFE,
   - any risky nearby legit domain → expected NOT flagged.

6. **Verify:** `npm test`. If you changed detection broadly, also
   `npm run build && npm run test:e2e` and confirm the FP-regression specs in
   `e2e/specs/phase3-detection-ux.spec.ts` stay green.

## Done when

`npm test` is green, the new look-alike is flagged, and no real site regressed.
