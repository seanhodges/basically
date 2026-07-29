## Why

The BBC Micro and BBC Master are the worst rows left in the semigraphics
matrix: 96 declared graphics bytes, none with a character of its own, none
typeable. Every MODE 7 mosaic in an imported teletext program renders as a
`{0xNN}` escape, and the palette the other machines gained does not exist.

Both obstacles the audit recorded are now gone. The mosaics map exactly onto
the Unicode sextants the TRS-80 already uses — same shapes, permuted bits —
and the bundled font already covers every one of them. The palette learned to
label a cell by character code for machines with no graphics keycaps, which
the BBC (like the CPC) is.

The declared range is also wrong: of `0xA0`–`0xFF`, the SAA5050 displays
`0xC0`–`0xDF` as capital letters even in graphics mode. The true mosaic set is
64 codes, and correcting the declaration is part of making the row honest.

## What Changes

- **The 63 non-blank mosaic codes gain their sextant characters** —
  `0xA1`–`0xBF` and `0xE0`–`0xFF` render as the Symbols-for-Legacy-Computing
  sextants (plus the half/full blocks Unicode keeps outside that run),
  decoding unconditionally: the editor always shows the graphics form, whatever
  display context a running program would put the byte in. The `{0xNN}`
  spelling keeps loading and encodes to the same byte.
- **Both BBC dialects gain a graphics palette**, cells labelled with the
  character code BBC BASIC feeds to `CHR$`, because no BBC keycap ever carried
  a graphic. One palette serves both machines — the Master shares the Micro's
  keyboard layout.
- **The declared graphics range shrinks to the cited truth**: `0xA0`–`0xBF`
  and `0xE0`–`0xFF`, per the teletext specification and the SAA5050
  implementation the IDE's own emulator ships.
- **Both dialects join the round-trip guarantee**: every palette character is
  proven to survive the editor, the tokenizer and a cassette export/import
  cycle.
- **The support doc's prose moves on**: the BBC leaves "machines this page
  does not yet cover", and the unconditional-decode wrinkle is recorded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: the bidirectional-charset requirement gains the case of
  a machine that shows one stored byte as either a graphic or a letter
  depending on display context — the graphics shape is the canonical editor
  form, and the editor does not vary a byte's spelling with context.

`virtual-input` gains no delta: the palette requirement already covers a
machine whose keyboard produced no graphics, and the BBC simply becomes such a
machine once its charset has graphics characters.

## Non-goals

- **`0xA0` stays escaped.** The empty mosaic draws a blank cell; its only
  faithful text form is a space, which `0x20` owns — the same gap the
  Spectrum, TRS-80 and CPC record for their `0x80`.
- **`0xC0`–`0xDF` stay escaped.** They are blast-through capitals, not
  mosaics, and a top-bit letter has no Unicode form of its own.
- **No context-aware decoding.** MODE 7's letters-or-mosaics switch depends on
  control codes, mode and screen state the charset cannot know; the editor
  shows the graphics form unconditionally.
- **The separated-mosaic forms are not mapped.** Contiguous versus separated
  is a display attribute the `{SEPARATED}` escape already spells, not a
  different character.
- **The Acorn Atom is untouched.** Its graphics range still needs primary
  sources; that research is its own piece of work.
- **No new font is sourced.** Every code point was bundled for the TRS-80.
