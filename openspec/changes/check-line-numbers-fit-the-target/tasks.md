## 1. A comparable line-number range

- [ ] 1.1 `src/reference/types.ts`: `PortingFacts` gains a structured range
      (minimum and maximum) beside `lineNumberRange`, documented as the range the
      machine's own editor accepts — the range a porter must renumber into — and
      not the wider range a tokenizer may be willing to store.
- [ ] 1.2 `src/reference/facts.ts`: author it for every machine from the prose
      row beside it, which is now ROM-verified for every machine that has a
      shippable ROM.
- [x] 1.3 Resolve the BBC's minimum (the prose said 1, the tokenizer accepts 0).
      *Done ahead of this change: the real ROM stores and lists `0REM Z` on both
      BASIC II and BASIC IV and answers `Syntax error` at 32768, so the row is
      now `0–32767`. The Altair's hyphen was normalised at the same time, and
      `facts-crosscheck.test.ts` now re-derives every machine's range from its
      own tokenizer.*
- [ ] 1.4 `src/reference/facts-crosscheck.test.ts`: the structured range equals
      the prose range for every machine (one parse, exact). The prose range is
      already re-derived from each dialect's tokenizer there; extend that case
      to the structured field rather than adding a second one.

## 2. What the program's numbers are

- [ ] 2.1 `src/app/programVocabulary.ts`: the vocabulary reports the program's
      lowest and highest line numbers, how many numbered lines it has, and how
      many statements it carries beyond one per line — read in the same walk that
      already strips the line number from each line and counts the
      multi-statement ones. Lines with no number contribute to neither.
- [ ] 2.2 `src/app/programVocabulary.test.ts`: the counts for a program with
      several statements on several lines; a program whose separator appears
      inside a string or a REM contributes no extra statements; `#BIN` lines are
      not counted; an empty program reports nothing.
- [ ] 2.3 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new fields
      cross the boundary and the two sides' field lists still agree by string.

## 3. The finding

- [ ] 3.1 `src/reference/compare.ts`: a pure line-number finding over the two
      machines' facts and the vocabulary — below the target's minimum, above its
      maximum, or nothing — in the same shape as `statementLayoutForProgram`.
- [ ] 3.2 Same file: `StatementLayoutChange` gains the projected line count for
      the `split` case (lines plus statements beyond the first), and whether the
      target's range can hold it under the tightest renumbering (minimum, step
      one). `reseparate` projects nothing: the line count does not change.
- [ ] 3.3 `src/reference/compare.test.ts`: over and under the target's range;
      within it; the projection for a split that fits and one that cannot;
      `reseparate` reporting no projection; a program with no numbered lines.

## 4. Reporting it

- [ ] 4.1 `docs/.vitepress/theme/components/DialectCompare.vue`: render the
      line-number finding, and the projected count within the statement-layout
      section that causes it; both absent when the comparison is not narrowed.
      Add the finding to `pageSections` on the same condition it renders under.
- [ ] 4.2 `src/ai/portReport.ts` + `portDescription.ts`: the port handed to the
      assistant carries the line-number finding and the projection, alongside the
      statement-layout change it already carries; update `portDescription.test.ts`.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint` and `npm run format:check`
- [ ] 5.4 `npm run docs:build`
- [ ] 5.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: a program numbered past the target's ceiling reports the
      renumbering, and a colon-heavy program ported to a one-statement-per-line
      machine reports its projected line count. Only check off when it passes.
