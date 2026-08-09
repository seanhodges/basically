## 1. What the program's text proves

- [ ] 1.1 `src/app/programVocabulary.ts`: the vocabulary reports the screen
      modes the program selects with the machine's own mode command — the
      constant values, and whether any selection is not a constant — read from
      the same scannable text as everything else, so a mode keyword inside a
      string or a REM contributes nothing. Machines without a mode command
      report nothing.
- [ ] 1.2 `src/app/programVocabulary.test.ts`: constant modes collected;
      a computed mode sets the flag; a mode keyword in a string is inert; a
      machine with no mode command reports nothing.
- [ ] 1.3 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new field
      crosses the boundary and the two sides' field lists still agree by string.

## 2. The regions the machines declare

- [ ] 2.1 `src/dialects/types.ts`: the memory-blocks support contract gains
      optional conditionally free ranges — range, condition (modes the program
      must stay within, or keywords it must not use), note — and the machine's
      mode command with its boot mode. Both optional; undeclaring machines are
      untouched.
- [ ] 2.2 `src/dialects/atom/memoryBlocks.ts` + colocated test: the video RAM
      above the text screen's page, free while every selected mode is the text
      mode; bounds asserted against the machine's own address constants.
- [ ] 2.3 `src/dialects/bbcmicro/memoryBlocks.ts`,
      `src/dialects/bbcmaster/memoryBlocks.ts` + colocated tests: the band
      between the bitmap screens' lowest floor and the teletext screen, free
      while every selected mode is the teletext mode.

## 3. The linter

- [ ] 3.1 `src/app/blockLint.ts`: the linter optionally takes the open
      program's vocabulary. A block inside a conditionally free region is
      accepted with a warning naming the condition when the condition is met —
      every selected mode within the set (the boot mode where none is
      selected), no computed selection, no program write inside the region —
      and refused with the condition named otherwise, including when no
      vocabulary is supplied.
- [ ] 3.2 Same file: the BBC's blanket screen-band warning is not emitted for a
      block whose placement the met condition already accounts for — the
      conditional warning replaces it rather than stacking on it.
- [ ] 3.3 `src/app/blockLint.test.ts`: the met / unmet / computed-mode /
      write-inside / no-vocabulary matrix on a machine that declares a region;
      a machine that declares none lints byte-for-byte as before.
- [ ] 3.4 `src/components/EmulatorPane.tsx`: the run gate hands the linter the
      vocabulary it already computes.

## 4. The porting comparison

- [ ] 4.1 `src/reference/types.ts` + `src/reference/facts.ts`: the regions
      restated as reference data — start, end, bytes, condition, note — for the
      Atom, BBC Micro and BBC Master.
- [ ] 4.2 `src/reference/facts-crosscheck.test.ts`: the restated regions agree
      byte-for-byte with the dialect declarations, condition included.
- [ ] 4.3 `src/reference/compare.ts` + `compare.test.ts`: a pure condition
      evaluator over the vocabulary, and the conditionally-free-memory finding,
      produced only when the fit verdict is close-to-limit or over and the
      condition is met.
- [ ] 4.4 `src/reference/portDescription.ts` + its test: the finding rendered
      with the fit report, ending with the posed decision (move data there, or
      shorten the program); absent under no pressure, an unmet condition, or no
      program.
- [ ] 4.5 `docs/.vitepress/theme/components/DialectCompare.vue`: the finding
      inside the existing fit block, under the same gate.
- [ ] 4.6 `src/ai/portReport.ts` + its test: the finding joins the hand-over
      when and only when the comparison itself reports it.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint` and `npm run format:check`
- [ ] 5.4 `npm run docs:build`
- [ ] 5.5 `npm run e2e:chromium -- e2e/memory-blocks` — extend an existing
      journey: a block placed in the Atom's video RAM runs with the condition
      warning while the program stays in text mode, and is refused when a
      graphics mode is selected. Only check off when the run passes.
- [ ] 5.6 `npm run e2e:chromium -- e2e/porting-guidance` — the fit report of a
      pressed program names the conditionally free memory. Only check off when
      the run passes.
