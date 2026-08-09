## 1. Geometry and speed as facts

- [ ] 1.1 `src/reference/types.ts` + `src/reference/facts.ts`: every machine
      states its boot text screen as columns and rows beside the prose, its
      measured speed, and its clock idiom — the one authored phrase naming how
      a program waits on that machine.
- [ ] 1.2 `src/reference/facts-crosscheck.test.ts`: the structured geometry
      agrees with the columns-by-rows figure the prose states; the clock idiom
      answers to the machine's own reference rows.
- [ ] 1.3 A registry-driven benchmark test: boot every registered machine, run
      the same empty counting loop (a per-machine spelling where a dialect
      needs one, held in the fixture), count emulated frames, and pin each
      authored speed within a stated tolerance. One threshold constant, stated
      with the fixture, decides what "differ materially" means.

## 2. What the program states

- [ ] 2.1 `src/app/programVocabulary.ts`: constant position arguments —
      row-and-column, single-offset, and the operands of position control
      codes the escape scan currently discards — and empty counting loops,
      collected under the usual rules; computed positions counted, not judged.
- [ ] 2.2 `src/app/programVocabulary.test.ts`: positions collected per form;
      a position in a string is inert; a computed position sets its flag; a
      loop with a body is not an empty loop; nested and stepped empty loops.
- [ ] 2.3 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new
      fields cross the boundary and the field lists agree by string.

## 3. The findings

- [ ] 3.1 `src/reference/compare.ts` + `compare.test.ts`: the positions
      finding — constants beyond the target's boot screen; the width-encoding
      rule for single offsets; nothing on fit-and-agree; the boot-screen
      caveat when the program selects other modes.
- [ ] 3.2 Same files: the delays finding — empty loops present and the
      measured ratio material; quotes the ratio and the target's clock idiom;
      nothing under the threshold or without empty loops.
- [ ] 3.3 Same files: the colour and sound decisions attach to the existing
      lost-capability accounts exactly when the program uses the capability
      and the target lacks it.
- [ ] 3.4 `src/reference/porting.ts` + crosschecks: the two authored input
      rows — the file-record meaning of the key-read word, and the timed
      key-read that blocks on one machine and cannot on another — with
      reference rows on the machines they name.

## 4. Reporting

- [ ] 4.1 `src/reference/portDescription.ts` + its test: positions among the
      silent failures with the reflow-or-clip decision posed once; delays
      beside them with the retune-or-reclock decision; the capability
      decisions inside the accounts they ride; every section absent exactly
      when its finding is absent.
- [ ] 4.2 `docs/.vitepress/theme/components/DialectCompare.vue`: the findings
      rendered under the same conditions.
- [ ] 4.3 `src/ai/portReport.ts` + its test: all three join the hand-over.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint` and `npm run format:check`
- [ ] 5.4 `npm run docs:build`
- [ ] 5.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: a program printing at column 35 reports the position against a
      32-column target. Only check off when the run passes.
