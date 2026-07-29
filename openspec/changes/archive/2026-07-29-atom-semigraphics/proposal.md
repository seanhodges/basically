## Why

The Acorn Atom is the last "_not established_" row in the semigraphics matrix,
and the only registered machine with no graphics characters and no palette at
all. That gap is now purely one of implementation: the research in
`docs/contributing/dialect-plans/atom-semigraphics.md` established, by probing
the genuine Atom Kernel ROM, that `PRINT` of string byte `0xA0 + p` always
draws MC6847 Semigraphics-6 pattern `p` — 64 sextant cells, the same shape
family the TRS-80 and BBC already spell with `sextantGlyph()`, and every code
point already in the bundled font.

Until that mapping ships, every Atom graphics byte renders as `{0xNN}`, the
escapes reference page describes the whole `0x80`–`0xFF` range as inverse video
(which is wrong for `0xA0`–`0xFF`), and the audit has to keep reporting the
Atom as unresearched to avoid reporting 64 fresh gaps.

## What Changes

- **The 63 non-blank Semigraphics-6 codes gain their sextant characters.**
  `0xA1`–`0xDF` render as the Symbols-for-Legacy-Computing sextants (plus the
  half and full blocks Unicode keeps outside that run), via
  `sextantGlyph(reverse6(code - 0xA0))` — the MC6847 numbers its six cells in
  the exact reverse of Unicode's order. `{0xNN}` keeps loading and encodes to
  the same byte.
- **The Atom gains a graphics palette**, cells labelled with the character code
  (no Atom keycap prints a graphic), wired as a new editor mode on the existing
  keyboard layout.
- **`SEMIGRAPHIC_CODES.atom` stops being `null`** and declares `0xA0`–`0xDF`,
  citing the kernel-ROM WRCH probe and a glyph-table crosscheck against the
  MC6847 font the IDE's own emulator draws with.
- **The Atom joins the round-trip guarantee** (`IN_SCOPE`): every palette
  character is proven to survive the editor, the tokenizer and an `.atm`
  export/import cycle.
- **The escapes reference page is corrected.** `0x80`–`0xFF` is not uniformly
  inverse video: only `0x80`–`0x9F` is (inverse digits and punctuation),
  `0xA0`–`0xDF` is graphics, and `0xE0`–`0xFF` repeats patterns `0x20`–`0x3F`
  in the other colour set. The current page's example — `{0xC1}` as "inverse
  A" — is factually wrong and is replaced.
- **The support doc's prose moves on**: the Atom leaves "machines this page
  does not yet cover", and `dialect-plans/atom-semigraphics.md` is deleted, as
  that directory's convention requires of the change that implements a plan.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: the bidirectional-charset requirement gains the case of
  a machine that draws the *same* graphics shape from more than one byte. Only
  one of those bytes can carry the Unicode character without breaking the
  one-text-form-per-byte invariant the mapping rests on; the requirement says
  which one wins and that the others keep a spelling that still round-trips.

`virtual-input` gains no delta: the palette requirement already covers a
machine whose keyboard produces no graphics and labels those cells by
character code (the BBC and CPC case). The Atom simply becomes such a machine.

## Impact

- `src/dialects/atom/charset.ts` — decode and `parseChar` gain the sextants;
  `glyph()` gains their display forms. The shared `src/dialects/sextants.ts` is
  reused unchanged.
- `src/dialects/atom/graphics.ts` (new) and
  `src/dialects/atom/keyboardLayout.ts` — the palette and its editor mode.
- `src/dialects/atom/tokenizer.ts` — confirm the literal and error paths handle
  astral characters; the encode itself already goes through the charset.
- `src/dialects/semigraphicsAudit.ts` — `SEMIGRAPHIC_CODES.atom` and
  `IN_SCOPE`; `src/dialects/semigraphicsRoundTrip.test.ts` and
  `e2e/paletteMachines.ts` gain the Atom.
- `docs/contributing/semigraphics-support.md` (regenerated plus prose),
  `docs/reference/data/escapes/atom.ts`, `src/dialects/atom/aiProfile.ts`, and
  the deletion of `docs/contributing/dialect-plans/atom-semigraphics.md`.
- No change to the `Dialect` / `MachineEmulator` seam, no new dependency, no
  new font: every code point was bundled for the TRS-80 and BBC.

## Non-goals

- **`0xA0` stays escaped.** The blank cell's only faithful text form is a
  space, which `0x20` owns — the same gap the Spectrum, TRS-80, CPC and BBC
  record for their blank.
- **`0xE0`–`0xFF` stay escaped.** They draw patterns `0x20`–`0x3F` again in the
  other colour set. Colour is not representable in editor text, and a second
  spelling for the same shape would break the mapping's injectivity.
- **`0x80`–`0x9F` stay escaped.** Inverse digits and punctuation have no
  Unicode form of their own.
- **Colour is not represented.** The MC6847's two Semigraphics-6 colour sets
  differ only in hue; the editor shows shape.
- **The poke-only patterns are not addressed.** Screen codes `0x40`–`0x5F` are
  reachable only by writing `#8000` directly, which is numeric literals in
  program text, not string bytes — outside what a charset maps.
- **No new sample program.** Showing the palette off in the bundled Atom
  samples is separate work.
