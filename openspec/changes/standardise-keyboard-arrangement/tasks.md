# Tasks: standardise-keyboard-arrangement

## 1. Shared template building blocks

- [x] 1.1 Add `LayerDef.modeOnly?: boolean` to `src/keyboard/layoutSchema.ts`
      and render/select support in `VirtualKeyboard.tsx` (mode-only layers
      draw legends only while pinned; excluded from the compact layer
      selector and the `--vk-max-len` scan when inactive), with a colocated
      unit assertion
- [x] 1.2 Add `flankedRow(shift, letters, del)` to
      `src/keyboard/templateRows.ts` (validates 7 letters; spans 6/4×7/6)
- [x] 1.3 Add the canonical SYM map constants to `templateRows.ts` (two
      pages aligned with the 10/9/7 letter bands; only machine-supported
      symbols occupy slots) and a builder that welds a machine's
      `symbol → {emits, insert?}` table onto its rows as `sym`/`sym2`
      layer legends, plus the SYM mode/`shiftedLayer` wiring helper
- [x] 1.4 Cover the new builders in a colocated `templateRows.test.ts`
      (the positional welding in `withSymbolMode` builds the labels itself,
      so no separate `symKey` legend builder was needed)

## 2. Migrate the layouts (one machine per commit; legends and matrix
      tokens unchanged)

- [x] 2.1 zx81: flanked row, 9-key home row, bottom row `␣ " ↵`, SYM
      mode/map, KEYWORD+FUNCTION tabs removed; update
      `zx81/keyboardLayout.test.ts`
- [x] 2.2 zx80: same shape as zx81; update its test
- [x] 2.3 zxspectrum (+128 variant): SymShift keeps the bottom-left; SYMBOL
      mode re-pointed at the canonical layers; KEYWORD+FUNCTION tabs
      removed; update tests
- [x] 2.4 bbcmicro (= bbcmaster): Escape bottom-left; `, . /` and `[ ]`
      etc. into the SYM map; update tests
- [x] 2.5 atom: same shape as bbcmicro; update tests
- [x] 2.6 cpc464 (+6128 variant): empty bottom-left; SYM re-pointed;
      update tests
- [x] 2.7 commodore64 (+vic20 variant): C= bottom-left, INST DEL as the
      delete flank; SYM re-pointed; update tests
- [x] 2.8 pet: empty bottom-left, INST DEL flank; new SYM mode; update
      tests
- [x] 2.9 trs80: BRK bottom-left, `←` delete flank; new SYM mode; update
      tests
- [x] 2.10 pmd85: standard arrangement (semicolon and friends into the SYM
      map, `;` home-row key removed, Enter to bottom right); new SYM mode;
      update tests against the ROM key-code table
- [x] 2.11 altair8800: standard arrangement (CTRL bottom-left; `; : -`
      into the SYM map); new SYM mode; update tests against `tokenToByte`

## 3. Registry-wide rules

- [x] 3.1 Re-pin `src/keyboard/layoutGeometry.test.ts` to the new template:
      9-key centred home row; band 3 = shift(6) + 7 letters + delete(6);
      bottom row ends quote-then-Enter; letter bands letters-only
- [x] 3.2 Extend it to enforce the SYM rules for every registered machine:
      each `sym`/`sym2` legend matches the canonical symbol for its slot,
      unmapped slots are blank, and page 2 (and its toggle) exists only
      when something is mapped on it
- [x] 3.3 Grep for references to removed key ids (`Comma`, `Period`,
      `Slash`, `Semicolon`, …) in samples, e2e, controller configs; the one
      hit (`e2e/code-editor/completion-abbreviation.spec.ts` tapping the
      Period keycap) is fixed under 4.2

## 4. Docs and e2e

- [x] 4.1 Update the keyboard-authoring section of
      `docs/contributing/adding-a-dialect.md` with the arrangement and SYM
      rules
- [x] 4.2 Extend the `e2e/virtual-input/touch-input.spec.ts` journey with a
      SYM-mode assertion (tap a symbol with the editor focused, the source
      receives it)

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run e2e:chromium -- e2e/virtual-input`
- [x] 5.3 `npm run docs:build` (docs/ changed)
- [x] 5.4 Visual pass (headless screenshots over `npm run dev`): ZX81,
      Spectrum, C64, BBC and PMD 85 match the template and SYM map;
      machine-focus symbol presses are covered per machine by
      `src/dialects/symbolKeys.test.ts` on the booted ROMs; Sinclairs show
      keyword legends with no KEYWORD/FUNCTION tabs

## 6. Layered display normalisation (follow-up)

- [x] 6.1 Rename the key display from "Authentic" to "Layered" (setting
      value migrates on read; UI label, prop and store types renamed)
- [x] 6.2 Renderer: SYM page-1 hints on letter keys in the theme's ink,
      case-following single letters where base+shift are a case pair, and
      `modeOnly` cursor layers so arrows appear only in CURSOR mode
- [x] 6.3 Strip symbol and keyword legends from every shift layer (letters'
      case pairs and the Sinclair arrows stay); remove the Spectrum's
      display-only symbol layer; update the per-dialect tests
- [x] 6.4 Extend `layoutGeometry.test.ts`: no non-SYM layer types a
      canonical symbol on the typing bands
- [x] 6.5 Spec delta: "The layered key display" requirement, the
      symbols-only-via-SYM rule, and the reworded authenticity paragraph

## 7. CURSOR mode blanks the letter bands (follow-up)

- [x] 7.1 `withSymbolMode` blanks every key above the bottom row that a
      modeOnly overlay mode leaves unlabelled (number row and flanks
      included), with a `templateRows.test.ts` case
- [x] 7.2 Registry-wide rule in `layoutGeometry.test.ts`: in CURSOR mode a
      key above the bottom row carries an arrow or the inert blank label
- [x] 7.3 Update the seven dialect tests that asserted base-layer fallback
      typing in CURSOR mode, and the layout header comments claiming it
- [x] 7.4 Spec delta + `adding-a-dialect.md`: cursor mode shows only its
      arrows; only the bottom row stays live

## 8. One marking at a time on every screen (follow-up)

- [x] 8.1 Renderer: the secondary-legend filter applies at every size; the
      responsive compact mode, its breakpoints and its class are removed
- [x] 8.2 `VirtualKeyboard.css`: every layer position but `center` collapses
      into one slot under the base legend; legend sizes come from the
      keycap's own width, with the landscape-phone tier keeping a flat size
- [x] 8.3 Themes colour the layer rather than the corner - which is what
      colours a cursor overlay's arrows for the first time - and rules
      naming a corner no layer of that machine has are removed
- [x] 8.4 Colocated assertions in `keyboardTheme.test.ts`: no position-keyed
      theme ink, no themed layer id its machines do not declare, and no rule
      keyed to the retired responsive class
- [x] 8.5 Spec delta, `docs/contributing/adding-a-dialect.md`,
      `docs/guide/testing-programs.md` (also stale on the display's name),
      and the Sinclair layout headers
- [x] 8.6 `npm run typecheck && npm test && npm run lint && npm run format:check`;
      `npm run docs:build`; `npm run e2e:chromium -- e2e/virtual-input`
