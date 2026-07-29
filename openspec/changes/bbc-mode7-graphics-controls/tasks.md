## 1. The control-chip seam

- [x] 1.1 Add `ControlChip` and `Dialect.displayControls` to
      `src/dialects/types.ts`: a table keyed by the escape text exactly as the
      charset spells it, each entry carrying the colour the code selects (when
      it selects one), the symbol to draw, and the full name for the tooltip
      and accessible label. Document that it is presentation only.
- [x] 1.2 Derive the drawing once as constrained shape data (`chipShapes`) in
      `src/dialects/controlChip.ts` - the rule `src/keyboard/GlyphSvg.tsx`
      already follows, never markup - with the ink chosen from the fill's
      luminance; render it in `src/keyboard/ControlChipSvg.tsx` for the palette
      and from the same data in the editor's widget. No external assets.
- [x] 1.3 Colocated `src/dialects/controlChip.test.ts`: every symbol has
      shapes, they all stay inside the chip box, the ink flips between light
      and dark fills, and a code with no colour draws on paper.

## 2. The BBC teletext chips

- [x] 2.1 New `src/dialects/bbcmicro/teletextChips.ts`: a `ControlChip` for
      every code in `TELETEXT_NAMES`, built from that table so a named code
      cannot be missing, with the seven teletext colours taken from jsbeeb's
      `BbcDefaultPalette` rather than retyped. `{0xNN}` raw escapes get no
      chip.
- [x] 2.2 Wire `displayControls` into `src/dialects/bbcmicro/index.ts` and
      `src/dialects/bbcmaster/index.ts` (the Master re-exports, as it does the
      charset and layout).
- [x] 2.3 Extend `src/dialects/bbcmicro/mode7Graphics.test.ts` with the pins
      derived from jsbeeb's `Teletext`: each graphics-colour code leaves
      `gfx` set and selects the graphics glyphs; each text colour clears it;
      `{SEPARATED}`/`{CONTIGUOUS}` select the separated/contiguous sets; the
      palette's colour set is exactly the codes that turn `gfx` on; and each
      chip colour matches `BbcDefaultPalette`.

## 3. The palette

- [x] 3.1 `src/keyboard/layoutSchema.ts`: `GraphicEntry.chip?: ControlChip`
      (presentation only — `char` stays the inserted text) and a section
      `note?: string`.
- [x] 3.2 `src/dialects/bbcmicro/graphics.ts`: `BBC_GRAPHICS_COLOURS`
      (`0x91`–`0x97`) and `BBC_GRAPHICS_STYLES` (`0x99`, `0x9A`, `0x9E`,
      `0x9F`) built from the charset's names and the chip table; extend
      `BBC_GRAPHICS`.
- [x] 3.3 `src/dialects/bbcmicro/keyboardLayout.ts`: four sections — graphics
      colours (with the note stating the rule) first, the two retitled mosaic
      banks, graphics styles last.
- [x] 3.4 `src/keyboard/VirtualKeyboard.tsx` + `.css`: render the chip instead
      of the glyph when an entry has one, keep the corner code hint, name the
      cell by what the code does, and render the section note.
- [x] 3.5 Update `src/dialects/bbcmicro/keyboardLayout.test.ts` (four
      sections; control entries carry a chip, mosaics do not) and the BBC
      cases in `src/dialects/semigraphicsRoundTrip.test.ts` (`outsideRange`
      for the control codes).

## 4. The editor

- [x] 4.1 New `src/editor/controlChipWidget.ts` on the `binaryLineWidget.ts`
      pattern: a state field of replace-decorations over the dialect's control
      escapes inside string literals, provided as decorations and atomic
      ranges, with a base theme sizing the chip to the line.
- [x] 4.2 Gate it on `dialect.displayControls` in
      `src/components/CodeMirrorHost.tsx`, beside the binary-line gate.
- [x] 4.3 Colocated `src/editor/controlChipWidget.test.ts`: escapes inside a
      string collapse and are atomic; an escape outside a string does not; a
      `{0xNN}` raw escape never does; the document text is untouched.

## 5. The regression the report was about

- [x] 5.1 Add a MODE 7 screen-RAM test to
      `src/emulator/bbc/bbcMachine.test.ts`: a program printing a graphics
      colour followed by mosaics puts those bytes on one screen row, proving
      the bytes reach the machine intact and that the letters the user saw
      were the SAA5050's own behaviour.

## 6. Docs

- [x] 6.1 `docs/reference/bbc/escapes.md`: a MODE 7 section stating the rule
      (every screen line starts in text mode; the text colours turn graphics
      off; a control code occupies a screen cell), what the chips mean, and a
      worked example.
- [x] 6.2 `docs/reference/bbc/hardware.md`: a sentence in the MODE 7 paragraph
      linking to it.
- [x] 6.3 `docs/contributing/semigraphics-support.md`: extend the existing
      "only sometimes a mosaic" note with where the IDE now teaches the rule.
      Prose only, nothing between the generated markers.

## 7. Quality gates

- [x] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 7.2 `npm run docs:build` (docs/ changed)
- [x] 7.3 `npm run e2e:chromium -- e2e/virtual-input`
- [x] 7.4 `npm run e2e:chromium -- e2e/code-editor`
