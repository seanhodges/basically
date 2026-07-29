## 1. Shared sextant mapping

- [x] 1.1 Lift `sextantGlyph()` and its special-pattern table out of
      `src/dialects/trs80/charset.ts` into a shared `src/dialects/sextants.ts`
      (the `sinclairCharset.ts` precedent), documenting the cell-to-bit layout
      it expects; the TRS-80 charset imports it and its tests still pass
      unchanged.

## 2. The BBC charset

- [x] 2.1 In `src/dialects/bbcmicro/charset.ts`, decode `0xA1`–`0xBF` and
      `0xE0`–`0xFF` to sextant characters via
      `(code & 0x1F) | ((code & 0x40) >> 1)`, leaving `0xA0` as `{0xA0}`;
      accept the sextant characters (full code points — they are astral) in
      `parseChar` mapping back to the same bytes; keep `{0xNN}` loading; give
      `glyph()` the sextant forms. Update the module comment's account of the
      top-bit range.
- [x] 2.2 Make the tokenizer's literal and error paths consume astral
      characters as one unit (mirror `src/dialects/trs80/tokenizer.ts`), so a
      sextant in a string tokenizes to one byte and a backspace cannot strand
      half a surrogate pair.
- [x] 2.3 Extend `src/dialects/bbcmicro/charset.test.ts`: each mosaic code
      round-trips both directions; its `{0xNN}` spelling still encodes to the
      same byte; `0xA0` and `0xC0`–`0xDF` stay escaped; a sextant inside a
      string literal tokenizes to its byte.
- [x] 2.4 Add a crosscheck test deriving the shapes from jsbeeb's own SAA5050
      (`jsbeeb/src/teletext.js` glyph builder): for every declared mosaic
      byte, the six cells our sextant character claims are exactly the cells
      jsbeeb lights, and `0xC0`–`0xDF` render as their letter glyphs
      (blast-through) — in the spirit of
      `src/dialects/sinclairGraphics.test.ts`.

## 3. The BBC palette

- [x] 3.1 New `src/dialects/bbcmicro/graphics.ts`: `GraphicEntry[]` for the 63
      mosaics in two byte-order banks (`0xA1`–`0xBF`, `0xE0`–`0xFF`),
      characters taken from the charset's own decode, no `key` (no BBC keycap
      carries a graphic — record that in the doc comment).
- [x] 3.2 Wire the `palette: 'graphics'` editor mode and `graphicsPalette`
      into `src/dialects/bbcmicro/keyboardLayout.ts`; confirm the Master
      inherits both through its shared-layout import.
- [x] 3.3 Extend `src/dialects/bbcmicro/keyboardLayout.test.ts`: every palette
      `char` re-encodes to its declared `code`.

## 4. Audit and round-trip guarantee

- [x] 4.1 In `src/dialects/semigraphicsAudit.ts`, correct
      `SEMIGRAPHIC_CODES.bbcmicro`/`bbcmaster` to `0xA0`–`0xBF` +
      `0xE0`–`0xFF`, citing the teletext bit-5 rule and the jsbeeb crosscheck;
      add both ids to `IN_SCOPE`.
- [x] 4.2 Add `bbcmicro` and `bbcmaster` to `e2e/paletteMachines.ts` in
      registry order.
- [x] 4.3 Add both dialects to `src/dialects/semigraphicsRoundTrip.test.ts`,
      with `notText` naming `0xA0` (the blank mosaic).
- [x] 4.4 Confirm no new code points: the audit's required set is unchanged, so
      the bundled font subsets, `coverage.json` and the `unicode-range` rules
      stay as they are (`src/dialects/fontCoverage.test.ts` proves it).

## 5. Documentation

- [x] 5.1 Run `npm run gen:semigraphics` and confirm
      `docs/contributing/semigraphics-support.test.ts` passes.
- [x] 5.2 Rewrite the doc's hand-written prose: drop the BBC bullet from
      "Machines this page does not yet cover" (the Atom stays), and add a
      "known wrinkles" entry for the unconditional decode — a top-bit byte
      meant as MODE 7 text shows as its mosaic twin — and for the blank `0xA0`
      joining the untypeable-blank club.
- [x] 5.3 Note the mosaic spelling in `src/dialects/bbcmicro/aiProfile.ts` and
      `src/dialects/bbcmaster/aiProfile.ts`, as the TRS-80's profile does.
- [x] 5.4 Check `docs/reference/data/escapes/bbc.ts` and the published BBC
      escapes page: the `{0xNN}` guidance for the graphics range must now
      describe the sextant characters as the canonical form.

## 6. Quality gates

- [x] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 6.2 `npm run docs:build` (docs/ changes in this change)
- [x] 6.3 `npx openspec validate --specs`
- [x] 6.4 `npm run e2e:chromium -- e2e/virtual-input`
