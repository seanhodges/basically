## 1. The Atom charset

- [ ] 1.1 In `src/dialects/atom/charset.ts`, add a `sextantChar(code)` that
      returns `sextantGlyph(reverse6(code - 0xA0))` for `0xA1`–`0xDF` and
      `undefined` for every other byte (including the blank `0xA0`), importing
      `sextantGlyph` from `../sextants` and documenting the MC6847 cell order
      (bit 5 top-left … bit 0 bottom-right) that makes the permutation a
      six-bit reversal.
- [ ] 1.2 Wire it into `decodeSpan` (graphics bytes decode to their sextant
      instead of `{0xNN}`), into `parseChar` (accept the sextants as full code
      points — they are astral — mapping back to the same byte, with `{0xNN}`
      still loading), and into `glyph()`. Rewrite the module comment's account
      of the top-bit range: `0x80`–`0x9F` inverse punctuation, `0xA0`–`0xDF`
      Semigraphics-6, `0xE0`–`0xFF` the same shapes in the other colour set.
- [ ] 1.3 Extend the charset tests (`src/dialects/atom/tokenizer.test.ts` holds
      the current charset cases; a colocated `charset.test.ts` is fine if they
      outgrow it): every code `0xA1`–`0xDF` round-trips both directions, its
      `{0xNN}` spelling still encodes to the same byte, `0xA0`, `0x80`–`0x9F`
      and `0xE0`–`0xFF` stay escaped, and the totality/injectivity sweep over
      all 256 bytes still passes.
- [ ] 1.4 Confirm `src/dialects/atom/tokenizer.ts` handles a sextant in a
      string literal: it must encode to one byte, and `validateStatements`'
      column arithmetic and statement-skipping must not be confused by a
      surrogate pair (mirror `src/dialects/trs80/tokenizer.ts` if it is).
      Add a tokenizer test for a sextant inside a string literal either way.

## 2. Pinning the mapping to the hardware

- [ ] 2.1 New `src/dialects/atom/semigraphics.test.ts`: crosscheck against
      `makeCharsAtom()` from `jsbeeb/src/6847_fontdata.js` — for every declared
      byte, the six cells the sextant character claims are exactly the cells the
      emulator's glyph lights, in the spirit of
      `src/dialects/bbcmicro/mode7Graphics.test.ts`. Add the module to
      `src/emulator/atom/jsbeeb-atom.d.ts` if it is not already declared.
- [ ] 2.2 In the same file, a kernel-ROM probe test against the real Atom ROM
      (the machine tests in `src/emulator/atom/atomMachine.test.ts` already boot
      it): PRINT each byte `0xA0`–`0xDF` from a BASIC string literal and assert
      the screen code at `#8000` is `code + 0x20`, so the declared range is
      defended by the ROM rather than by a comment.

## 3. The Atom palette

- [ ] 3.1 New `src/dialects/atom/graphics.ts`: one `GraphicEntry[]` section for
      `0xA1`–`0xDF` in byte order, characters taken from the charset's own
      decode, no `key` — record in the doc comment that no Atom keycap prints a
      graphic and that Atom BASIC has no `CHR$`, so the code label is the only
      thing to teach.
- [ ] 3.2 Add a `palette: 'graphics'` editor mode and the `graphicsPalette` to
      `src/dialects/atom/keyboardLayout.ts`, alongside the existing ABC / SYM /
      CURSOR modes.
- [ ] 3.3 Extend `src/dialects/atom/keyboardLayout.test.ts`: every palette
      `char` re-encodes through `atomCharset.toMachine` to its declared `code`.

## 4. Audit and round-trip guarantee

- [ ] 4.1 In `src/dialects/semigraphicsAudit.ts`, replace
      `SEMIGRAPHIC_CODES.atom = null` with `0xA0`–`0xDF`, citing the kernel-ROM
      WRCH probe and the glyph-table crosscheck from task group 2; add `atom` to
      `IN_SCOPE`.
- [ ] 4.2 Add `atom` to `e2e/paletteMachines.ts` in registry order (between
      `vic20` and `trs80`), so `src/dialects/graphicsPalette.test.ts` passes.
- [ ] 4.3 Add `atom` to `src/dialects/semigraphicsRoundTrip.test.ts` with target
      `atom-atm`, `unreachable` naming `0xA0` (the blank cell, no text form) —
      no `twins` or `outsideRange`, since `0xE0`–`0xFF` is outside the declared
      range entirely.
- [ ] 4.4 Confirm no new code points: the sextants were all bundled for the
      TRS-80 and BBC, so `src/dialects/fontCoverage.test.ts` should pass with
      the font subsets, `coverage.json` and `unicode-range` rules untouched.

## 5. Documentation

- [ ] 5.1 Correct `docs/reference/data/escapes/atom.ts`: the inverse-video entry
      covers `0x80`–`0x9F` only (its `{0xC1}` "inverse A" example is wrong — that
      byte is a graphics cell), add a graphics entry for `0xA0`–`0xDF` naming the
      sextants as the canonical form with `{0xA0}` for the blank, and an entry
      for `0xE0`–`0xFF` as the other colour set's duplicates. Check
      `escape-crosscheck.test.ts` and `escape-data.test.ts` still pass, and that
      the published Acorn Atom escapes page reads correctly.
- [ ] 5.2 Run `npm run gen:semigraphics` and confirm
      `docs/contributing/semigraphics-support.test.ts` passes.
- [ ] 5.3 Rewrite the support doc's hand-written prose: drop the "Machines this
      page does not yet cover" section (the Atom was its last entry), and add
      "known wrinkles" entries for the blank `0xA0` joining the untypeable-blank
      club and for the second colour set at `0xE0`–`0xFF` staying escaped
      because two bytes cannot share one character.
- [ ] 5.4 Note the sextant spelling and the palette in
      `src/dialects/atom/aiProfile.ts`, as the TRS-80 and BBC profiles do.
- [ ] 5.5 Delete `docs/contributing/dialect-plans/atom-semigraphics.md` (the
      directory's convention: the change that implements a plan removes it) and
      check nothing else links to it — `docs/contributing/semigraphics-support.md`
      cites it today.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 6.2 `npm run docs:build` (this change touches `docs/`)
- [ ] 6.3 `npx openspec validate --specs`
- [ ] 6.4 `npm run e2e:chromium -- e2e/virtual-input` — the palette gains a
      machine, and `e2e/paletteMachines.ts` drives those specs
