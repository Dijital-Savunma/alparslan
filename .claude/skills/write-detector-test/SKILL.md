---
name: write-detector-test
description: Add a unit test for the URL/page detection engine following the project's existing table-driven style. Use when adding or changing a detection heuristic (homoglyph, typosquat, subdomain hiding, IP/TLD, page-content) or fixing a false positive/negative.
model: inherit
---

# Write a Detector Test

Detection changes must come with a test that locks the behavior. Match the
existing patterns — don't invent a new structure.

## Where tests go

| Area | File |
|------|------|
| Core URL checks, domain extraction, edit distance | `tests/detector/url-checker.test.ts` |
| Typosquatting (transposition, same-name/diff-TLD, subdomain hiding, substring, homoglyph, digit-confusable) | `tests/detector/typosquatting-deep.test.ts` |
| Broad phishing-effectiveness corpus / regressions | `tests/detector/detection-effectiveness.test.ts` |
| Page-content heuristics (forms, TCKN, urgency) | `tests/detector/page-analyzer.test.ts` |

## Steps

1. **Read the target test file** and copy its table-driven style (an array of
   `[input, expectation]` cases iterated with `it.each` / a loop). Keep imports
   and helpers consistent with what's already there.

2. **Cover both directions** for any detection change:
   - a malicious/look-alike input → expected level (SUSPICIOUS/DANGEROUS) and,
     where asserted, the `similarTo` brand and reason,
   - a legitimate input that's *near* the rule → expected SAFE / NOT flagged
     (this is the false-positive guard, and it's the part people forget).

3. **For a fixed false positive**, add the exact domain that misfired as a
   permanent "must stay SAFE" case (mirror the FP-regression entries).

4. **Pick the right entry point:** test the pure function
   (`checkTyposquatting`, `checkUrl`, `analyzePage`, `normalizeWhitelistInput`,
   …) directly — these are designed to be called without browser APIs.

5. **Run:** `npm test`. Confirm your new case fails before the fix and passes
   after (write the test first when fixing a bug).

## Done when

The new case(s) pass, the FP guard passes, and the rest of the suite is green.
