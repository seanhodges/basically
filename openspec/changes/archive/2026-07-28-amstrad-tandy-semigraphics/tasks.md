## 1. The CPC's unmapped codes

- [x] 1.1 Confirm `U+1FBA0`-`U+1FBA9`, `U+1FBAE`, `U+1FB8C`-`U+1FB8F`, `U+1FB95`
      and `U+1FB9C`-`U+1FB9F` by name against the Unicode character database,
      and each against the firmware ROM bitmap at `public/roms/cpc/cpc464.rom`
      offset `0x3800`.
- [x] 1.2 Add the twenty mappings to `CPC_GLYPHS` in
      `src/dialects/cpc464/charset.ts`, with the byte ranges' comments updated
      to say that only `0x80` is still escaped and why.
- [x] 1.3 Extend `src/dialects/cpc464/charset.test.ts`: each new code round-trips
      both directions, and its `{0xNN}` spelling still encodes to the same byte.
- [x] 1.4 Add a ROM crosscheck test deriving the shapes from `cpc464.rom` - the
      four diamond edges from `0xC0`-`0xC3` with `0xC4`-`0xCA` asserted to be
      their unions, and the dither regions classified by chequer phase - in the
      spirit of `src/dialects/sinclairGraphics.test.ts`.

## 2. Palette cells with no key

- [x] 2.1 Make `GraphicEntry.key` optional in `src/keyboard/layoutSchema.ts`,
      documenting that an entry without one is labelled by its character code.
- [x] 2.2 In `src/keyboard/VirtualKeyboard.tsx` render the decimal code in the
      cell's hint span when `key` is absent, update `graphicAriaLabel()`, and
      simplify the React list key to `code`.
- [x] 2.3 Update `src/dialects/graphicsPalette.test.ts` to require a character
      plus either a key or a character code.

## 3. The CPC and TRS-80 palettes

- [x] 3.1 New `src/dialects/cpc464/graphics.ts`: `GraphicEntry[]` for the
      mosaics, the box-drawing segments and the mapped upper block, characters
      taken from the charset's own table. Record in the doc comment that the
      firmware maps no key to a graphics code.
- [x] 3.2 New `src/dialects/trs80/graphics.ts`: the 63 sextants `0x81`-`0xBF`,
      characters taken from the charset's `sextantGlyph()`.
- [x] 3.3 Wire the `palette: 'graphics'` editor mode and `graphicsPalette` into
      `src/dialects/cpc464/keyboardLayout.ts` and
      `src/dialects/trs80/keyboardLayout.ts`; confirm CPC 6128 inherits both.
- [x] 3.4 Extend `cpc464/keyboardLayout.test.ts` and
      `trs80/keyboardLayout.test.ts`: every palette `char` re-encodes to its
      declared `code`.

## 4. Audit and round-trip guarantee

- [x] 4.1 Add `cpc464`, `cpc6128` and `trs80` to `IN_SCOPE` in
      `src/dialects/semigraphicsAudit.ts` and update its doc comment.
- [x] 4.2 Add the three ids to `e2e/paletteMachines.ts` in registry order.
- [x] 4.3 Add three `Case` entries to
      `src/dialects/semigraphicsRoundTrip.test.ts`, with `notText` for `0x80` on
      both families.
- [x] 4.4 Re-cut the primary font subset for the new code points per
      `src/assets/fonts/ATTRIBUTION.md`; update `coverage.json`, the
      `unicode-range` in `src/styles.css` and the attribution's coverage counts.

## 5. Documentation

- [x] 5.1 Run `npm run gen:semigraphics` and confirm
      `docs/contributing/semigraphics-support.test.ts` passes.
- [x] 5.2 Rewrite the doc's hand-written prose: drop the CPC and TRS-80 bullets
      from "Machines this change did not cover", and record the blank-cell gap
      the CPC now shares with the Spectrum.
- [x] 5.3 Fix the dead `src/keyboard/sinclairGlyphs.ts` seam row in
      `.claude/skills/adding-a-target-system/SKILL.md`, add the palette to its
      stage 1 and stage 3 rows, and record the `fontCoverage.test.ts` gotcha.
- [x] 5.4 Give `docs/contributing/adding-a-dialect.md` the same coverage and a
      cross-link to `docs/contributing/semigraphics-support.md`.

## 6. Quality gates

- [x] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 6.2 `npm run docs:build` (docs/ changes in this change)
- [x] 6.3 `npx openspec validate --specs`
- [x] 6.4 Add an `e2e/virtual-input/graphics-palette.spec.ts` case inserting a
      graphic on a machine with no graphics keys and asserting the cell shows
      its character code, then run
      `npm run e2e:chromium -- e2e/virtual-input`.
