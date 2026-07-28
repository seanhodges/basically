## Why

The `semigraphics-unicode-palette` change gave the Sinclair and Commodore
machines a graphics palette, a bundled font and an end-to-end round-trip
guarantee, and deliberately left the rest alone. Its audit records what the
others still need, and two families are ready now.

**Neither the Amstrad CPC nor the TRS-80 can type a single graphics
character.** Both have 64 block-graphics codes; both score 0 of 64 typeable.
The toolchain can represent shapes the user has no way to produce.

**The CPC cannot even represent a fifth of its range.** Twenty-one codes —
`0x80`, `0xC0`–`0xCA`, `0xCE` and `0xD8`–`0xDF` — render as `{0xNN}` numeric
escapes because nobody has mapped them. Twenty of the twenty-one are diamond
edges, dithers and dithered triangles that Unicode's Symbols for Legacy
Computing expresses exactly — the block the bundled font is already cut from.

**The palette assumes a keyboard these machines do not have.** It labels every
character with the physical key it lives on, because on a Spectrum or a C64
there is one. The CPC and the TRS-80 printed no graphics on their keycaps at
all — you wrote `PRINT CHR$(n)` — so the one thing the palette exists to teach
does not apply, and the requirement has to grow a second case rather than be
quietly broken.

## What Changes

- **The Amstrad CPC 464/6128 and the TRS-80 gain a graphics palette**, so every
  block graphic those machines can express becomes typeable.
- **Twenty CPC codes gain their real Unicode characters** — the diamond
  construction kit, the half-cell dithers, the chequerboard and the dithered
  triangles — each confirmed against the firmware ROM's own bitmap. The
  `{0xNN}` spelling keeps working when reading a program, so nothing saved
  stops loading.
- **A palette cell may be labelled by character code** instead of by key, for
  machines whose keyboard never produced the character. The cell teaches how the
  machine's own BASIC reaches it.
- **All three dialects join the round-trip guarantee**, so every character the
  palette offers is proven to survive the editor, the tokenizer and a hardware
  export/import cycle.
- **The dialect-authoring guides gain the palette**, which they never mentioned;
  the skill's block-graphics pointer names a file that no longer exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `virtual-input`: the graphics-palette requirement gains the case of a machine
  with no key for a character — the cell is labelled with how that machine's
  BASIC produces it rather than with a key that does not exist.

## Non-goals

- **CPC `0x80` stays escaped.** It is a blank cell whose only text form would be
  a space, which the charset's injectivity forbids — the Spectrum's `0x80` has
  the same gap.
- **No new font is sourced.** Every added code point is already covered by the
  upstream face the bundled subset is cut from; the subset is re-cut, not
  replaced.
- **The BBC Micro/Master and the Acorn Atom are untouched.** The BBC's mosaics
  are a semantic problem (the same byte is a mosaic only after a graphics-colour
  control code); the Atom's graphics range has not been established from a
  primary source. Both stay as the audit records them.
- **No charset change outside the six CPC codes.** No other machine changes what
  it emits.
