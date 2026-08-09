## 1. The facts the findings need

- [ ] 1.1 `src/reference/types.ts`: number handling gains an optional fractions
      alternative — the name of a separate system the machine offers reals
      through where its main path is integer-only — and `PortingFacts` gains
      optional authored marker traps: a marker character with what the machine
      does when a program carries it.
- [ ] 1.2 `src/reference/facts.ts`: author the Atom's fractions alternative (the
      floating-point ROM's `%A`–`%Z` variables) and the Altair's `%` trap
      (stored without complaint, `?SN ERROR` when the line runs). The number
      prose is already right on both and stays byte-for-byte, so the machine
      reference the assistant caches does not change.
- [ ] 1.3 `src/reference/facts-crosscheck.test.ts`: a fractions alternative may
      only be authored on an integer-only machine; a marker trap's marker must
      be absent from that machine's own marker set; the Altair trap is pinned by
      a console-run expectation (the line stores, the run fails).

## 2. What the program uses

- [ ] 2.1 `src/app/programVocabulary.ts`: the vocabulary reports the distinct
      whole-number values in the program's code at or above the smallest
      magnitude any registered integer-only machine cannot hold, read from the
      same scannable text as everything else, so a number inside a string or a
      REM contributes nothing.
- [ ] 2.2 `src/app/programVocabulary.test.ts`: the census collects a large
      literal, ignores one in a string, ignores small literals, and de-dupes.
- [ ] 2.3 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new field
      crosses the boundary and the two sides' field lists still agree by string.
- [ ] 2.4 `src/reference/facts-crosscheck.test.ts` (or the census's own test):
      the census bound is not above any registered integer-only machine's range
      ceiling, so a narrower machine registering later fails loudly.

## 3. The findings

- [ ] 3.1 `src/reference/compare.ts`: a pure range-narrowing finding — both
      machines integer-only, target strictly narrower — carrying both ranges and
      the program's values beyond the target's, present whenever a program is at
      hand for such a pair.
- [ ] 3.2 Same file: a pure marker-loss finding — markers the program's
      variables carry per the source's rule that the target's rule lacks — with
      fixed meanings (`%` integer, `!` single, `#` double; `$` never fires) and
      the target's authored trap where one exists.
- [ ] 3.3 `src/reference/compare.test.ts`: Atom→ZX80 fires with and without
      large literals; ZX80→Atom reports nothing; a floating-point machine on
      either side reports nothing; TRS-80→Altair reports `%` with the run-time
      trap and `#` as silent precision loss; BBC→C64 reports nothing for `%`
      (both have it); `$` never reported.

## 4. Reporting and handing over

- [ ] 4.1 `src/reference/portDescription.ts` + its test: the marker-loss section
      beside the variable collisions, the range section beside the truncated
      arithmetic — both in the silent-failures class — each ending with its
      `Decide:` line; the truncation section gains the fractions-alternative
      `Decide:` line when the target authors one; sections absent exactly when
      their finding is absent.
- [ ] 4.2 `docs/.vitepress/theme/components/DialectCompare.vue`: render both
      findings beside the findings they extend, under the same narrowing
      conditions.
- [ ] 4.3 `src/ai/portReport.ts` + its test: both findings join what the
      assistant is handed, and the hand-over instruction tells the assistant to
      settle each `Decide:` line from what the program does, saying which
      reading it chose where the program cannot settle it.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint` and `npm run format:check`
- [ ] 5.4 `npm run docs:build`
- [ ] 5.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: an integer program moving to a narrower integer machine reports
      both ranges and the value that does not fit. Only check off when the run
      passes.
