# Tasks: standardise-keyboard-arrangement

## 1. Shared template building blocks

- [ ] 1.1 Add `LayerDef.modeOnly?: boolean` to `src/keyboard/layoutSchema.ts`
      and render/select support in `VirtualKeyboard.tsx` (mode-only layers
      draw legends only while pinned; excluded from the compact layer
      selector and the `--vk-max-len` scan when inactive), with a colocated
      unit assertion
- [ ] 1.2 Add `flankedRow(shift, letters, del)` to
      `src/keyboard/templateRows.ts` (validates 7 letters; spans 6/4×7/6)
- [ ] 1.3 Add the canonical SYM map constants to `templateRows.ts` (two
      pages aligned with the 10/9/7 letter bands; only machine-supported
      symbols occupy slots) and a builder that welds a machine's
      `symbol → {emits, insert?}` table onto its rows as `sym`/`sym2`
      layer legends, plus the SYM mode/`shiftedLayer` wiring helper
- [ ] 1.4 Add a `symKey`-style legend builder to
      `src/keyboard/legendKit.ts` and cover the new builders in
      `legendKit.test.ts` / a colocated `templateRows` test

## 2. Migrate the layouts (one machine per commit; legends and matrix
      tokens unchanged)

- [ ] 2.1 zx81: flanked row, 9-key home row, bottom row `␣ " ↵`, SYM
      mode/map, KEYWORD+FUNCTION tabs removed; update
      `zx81/keyboardLayout.test.ts`
- [ ] 2.2 zx80: same shape as zx81; update its test
- [ ] 2.3 zxspectrum (+128 variant): SymShift keeps the bottom-left; SYMBOL
      mode re-pointed at the canonical layers; KEYWORD+FUNCTION tabs
      removed; update tests
- [ ] 2.4 bbcmicro (= bbcmaster): Escape bottom-left; `, . /` and `[ ]`
      etc. into the SYM map; update tests
- [ ] 2.5 atom: same shape as bbcmicro; update tests
- [ ] 2.6 cpc464 (+6128 variant): empty bottom-left; SYM re-pointed;
      update tests
- [ ] 2.7 commodore64 (+vic20 variant): C= bottom-left, INST DEL as the
      delete flank; SYM re-pointed; update tests
- [ ] 2.8 pet: empty bottom-left, INST DEL flank; new SYM mode; update
      tests
- [ ] 2.9 trs80: BRK bottom-left, `←` delete flank; new SYM mode; update
      tests
- [ ] 2.10 pmd85: standard arrangement (semicolon and friends into the SYM
      map, `;` home-row key removed, Enter to bottom right); new SYM mode;
      update tests against the ROM key-code table
- [ ] 2.11 altair8800: standard arrangement (CTRL bottom-left; `; : -`
      into the SYM map); new SYM mode; update tests against `tokenToByte`

## 3. Registry-wide rules

- [ ] 3.1 Re-pin `src/keyboard/layoutGeometry.test.ts` to the new template:
      9-key centred home row; band 3 = shift(6) + 7 letters + delete(6);
      bottom row ends quote-then-Enter; letter bands letters-only
- [ ] 3.2 Extend it to enforce the SYM rules for every registered machine:
      each `sym`/`sym2` legend matches the canonical symbol for its slot,
      unmapped slots are blank, and page 2 (and its toggle) exists only
      when something is mapped on it
- [ ] 3.3 Grep for references to removed key ids (`Comma`, `Period`,
      `Slash`, `Semicolon`, …) in samples, e2e, controller configs; fix any

## 4. Docs and e2e

- [ ] 4.1 Update the keyboard-authoring section of
      `docs/contributing/adding-a-dialect.md` with the arrangement and SYM
      rules
- [ ] 4.2 Extend the `e2e/virtual-input/touch-input.spec.ts` journey with a
      SYM-mode assertion (tap a symbol with the editor focused, the source
      receives it)

## 5. Quality gates

- [ ] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 5.2 `npm run e2e:chromium -- e2e/virtual-input`
- [ ] 5.3 `npm run docs:build` (docs/ changed)
- [ ] 5.4 Visual pass with `npm run dev`: every machine against the
      template and SYM map; C64 `PRINT 1,2` typed via SYM with the
      emulator focused; Sinclairs show keyword legends but no
      KEYWORD/FUNCTION tabs
