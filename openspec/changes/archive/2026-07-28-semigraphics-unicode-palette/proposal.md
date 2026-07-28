## Why

The Sinclair and Commodore machines both built block graphics ("semigraphics")
into their character sets, and both are only half-served today.

The **ZX Spectrum cannot type graphics at all**. Its charset already round-trips
the block graphics at `0x80–0x8F` and the user-defined graphics at `0x90–0xA4`,
but its on-screen keyboard has no graphics mode — so the toolchain can represent
characters the keyboard cannot produce. It is the last hole in Sinclair family
support.

**Representation is inconsistent between families.** The ZX80/ZX81 keyboard
draws its graphics as hand-built vector legends, while the Commodore machines
use the Unicode characters directly. Worse, five ZX81 graphics characters — the
grey (chequered) half-cells and their inverses — have **no Unicode form at all**
and are reachable only as backslash escapes, so the same program is written two
different ways depending on which character it uses.

**Where Unicode is used, it frequently does not render.** The Commodore shade
characters live in Unicode's "Symbols for Legacy Computing" block, which almost
no monospace font ships. The IDE bundles no font, so those characters appear as
empty boxes in the editor, on the keyboard, and in the published reference
tables — mapping work that is already done but invisible.

Finally, the **graphics keyboard overlay is cramped**. Graphics ride on the
letter keys at keycap size, which is hard to read on a phone and cannot express
a set larger than the keyboard.

## What Changes

- **Unicode becomes the single representation for semigraphics.** The five
  Sinclair grey characters gain their real Unicode characters, so every Sinclair
  and Commodore graphic has one canonical text form. The previously-canonical
  escape spellings are still accepted when reading a program, so nothing a user
  has saved stops loading.
- **A bundled character-graphics font ships with the IDE**, so every graphic a
  supported machine can express renders as its actual shape rather than a
  missing-glyph box — in the editor, on the keyboard, and in the documentation —
  regardless of what fonts the reader's device has.
- **The graphics keyboard overlay is replaced by a graphics palette**: a grid
  that shows each character at a readable size, reflows its column count to the
  viewport, and labels every cell with the physical key that character lives on
  so the palette teaches the real keyboard rather than replacing it.
- **The ZX Spectrum 48K and 128 gain graphics support** — block graphics and
  user-defined graphics — completing the Sinclair family.
- **Every mapped semigraphic is proven to round-trip** from the palette through
  the editor, the tokenizer, the emulator's memory image, and a hardware
  export/import cycle.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: the charset round-trip requirement gains a canonical-form
  guarantee — where Unicode has an exact character for a machine's graphic, that
  character is the canonical text form, while previously-canonical spellings
  remain readable.
- `code-editor`: adds a requirement that machine graphics characters are legible
  independent of the reader's installed fonts.
- `virtual-input`: the authentic-keyboard requirement gains the graphics palette
  — how a machine's graphics characters are offered when there are more of them
  than the keyboard can show at a readable size.

## Non-goals

- **The BBC Micro/Master, Acorn Atom, Amstrad CPC and TRS-80 are untouched.**
  Their charsets and keyboards are unchanged. The audit document records what
  each would need. The BBC in particular carries a genuine design question — the
  same byte is a mosaic only after a graphics-colour control code and a letter
  otherwise — that deserves its own change.
- **No charset change outside the five Sinclair grey characters.** In
  particular the CPC's unmapped upper range keeps its numeric escapes, so no
  machine outside the Sinclair family changes what it emits.
- **Escape-sequence syntax highlighting is not addressed.** No brace escape is
  highlighted in any dialect today; that is a separate change.
- **No fonts are derived from the bundled ROMs.** The ROM distribution
  permission covers emulation, not general-purpose font redistribution.
- **The palette lives in the on-screen keyboard only.** Reaching it from a
  desktop toolbar is a possible follow-up, not part of this change.
