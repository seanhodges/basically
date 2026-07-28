## Context

Three dialects are in scope: Amstrad CPC 464, CPC 6128 and TRS-80. See
`docs/contributing/architecture.md` for the overall layering and
`docs/contributing/semigraphics-support.md` for the derived per-machine matrix
this change moves. This document covers only what is specific to these two
families.

The `semigraphics-unicode-palette` change established the mechanisms: one
`GraphicEntry[]` table per dialect feeding both the keyboard and the charset, a
palette editor mode, a derived audit, and a round-trip test that names its
exceptions instead of skipping them. This change applies them, and modifies
exactly one assumption they baked in.

## Impact on the Dialect / MachineEmulator seam

**None.** Character representation stays behind `CharsetMapping`; the palette
stays data on `KeyboardLayout`; palette cells keep emitting the same
`EditorKeyAction { insert }` a key does. No new field on `Dialect`, no change to
`MachineEmulator`.

The one type that changes is `GraphicEntry.key`, which becomes optional — a
widening, so every existing table stays valid.

## Decisions

### A palette cell may name a character code instead of a key

The palette was built to teach the machine's keyboard: each cell shows the key
and modifier that produce its character. That is right for a Spectrum, whose
graphics are printed on the digit keys, and for a C64, whose are printed on the
key fronts. Neither the CPC nor the TRS-80 printed graphics on a keycap; on both
you reached them with `PRINT CHR$(n)`.

So for those machines the cell shows the decimal character code, which is what
the user would have typed into `CHR$` on the real machine. The cell still
teaches how the machine reaches the character — it is the machine that differs,
not the intent.

Rejected alternatives: a blank corner (the cell stops teaching anything, and
loses its only distinguishing text); the IDE's own `{0xNN}` escape (teaches the
IDE rather than the machine, and duplicates what the editor shows once the
character lands).

`GraphicEntry.key` therefore becomes optional rather than gaining a parallel
field, so an entry carries exactly one label and the renderer picks its form
from which one is present. `src/dialects/graphicsPalette.test.ts` currently
asserts `key` is non-empty everywhere; it becomes "a character, plus either a
key or a code", so the invariant still bites.

### The CPC's twenty new characters, from the firmware ROM

The CPC's 256-glyph character matrix sits at offset `0x3800` of the bundled
`public/roms/cpc/cpc464.rom`, eight bytes per glyph, one bit per pixel — located
by decoding candidate offsets and matching known codes against their existing
mappings. Reading the bitmaps out settles what the twenty-one unmapped codes
actually draw, rather than inferring it from a character-set table:

**The diamond construction kit.** `0xC0`–`0xC3` are the four diagonal edges of a
diamond, and `0xC4`–`0xCA` are unions of them — which is exactly how Unicode's
`U+1FBA0`–`U+1FBAE` family is defined, because it was encoded to cover charsets
like this one:

| Code | Edges inked | Character |
| --- | --- | --- |
| `0xC0` | NW | `U+1FBA0` … upper centre to middle left |
| `0xC1` | NE | `U+1FBA1` … upper centre to middle right |
| `0xC2` | SE | `U+1FBA3` … middle right to lower centre |
| `0xC3` | SW | `U+1FBA2` … middle left to lower centre |
| `0xC4` | NW+NE | `U+1FBA7` … middle left to upper centre to middle right |
| `0xC5` | NE+SE | `U+1FBA5` … upper centre to middle right to lower centre |
| `0xC6` | SE+SW | `U+1FBA6` … middle left to lower centre to middle right |
| `0xC7` | NW+SW | `U+1FBA4` … upper centre to middle left to lower centre |
| `0xC8` | NW+SE | `U+1FBA8` … upper centre to middle left and middle right to lower centre |
| `0xC9` | NE+SW | `U+1FBA9` … upper centre to middle right and middle left to lower centre |
| `0xCA` | all four | `U+1FBAE` box drawings light diagonal diamond |

**The dithers.** Chequer fills over a region of the cell:

| Code | ROM bitmap | Character |
| --- | --- | --- |
| `0xCE` | 2×2 chequerboard | `U+1FB95` checker board fill |
| `0xD8` | upper-half 1px chequer | `U+1FB8E` upper half medium shade |
| `0xD9` | right-half 1px chequer | `U+1FB8D` right half medium shade |
| `0xDA` | lower-half 1px chequer | `U+1FB8F` lower half medium shade |
| `0xDB` | left-half 1px chequer | `U+1FB8C` left half medium shade |
| `0xDC` | upper-left triangular chequer | `U+1FB9C` upper left triangular medium shade |
| `0xDD` | upper-right triangular chequer | `U+1FB9D` upper right triangular medium shade |
| `0xDE` | lower-right triangular chequer | `U+1FB9E` lower right triangular medium shade |
| `0xDF` | lower-left triangular chequer | `U+1FB9F` lower left triangular medium shade |

`0xD8` and `0xDA` are byte-identical to ZX81 `0x0A` and `0x09`, which
`src/dialects/zx81/charset.ts` already maps to `U+1FB8E` and `U+1FB8F` — so two
of them are confirmed against a mapping the project has already pinned. The
CPC's `0xCF`, already mapped to `▒`, is byte-identical to ZX81 `0x08`, which is
also `▒`; that agreement is what validates reading the table at this offset.

Every code point is confirmed by name against the Unicode character database
before coding, per the project's rule that machine behaviour comes from primary
sources rather than memory. All twenty fall in the original Symbols for Legacy
Computing block (Unicode 13), which the bundled `unscii-16` covers in full —
verified against the upstream face — so no new font has to be sourced.

Only `0x80` is left escaped: it is blank, and injectivity forbids a second
spelling of a space.

### The still-escaped codes stay out of the palette

Only `0x80` is still escaped, and it is excluded for the reason the Spectrum's
blank is: it renders as a space, so a cell for it would insert a space. It is
recorded as a named `notText` entry in the round-trip test, so the gap is
asserted rather than discovered.

### The TRS-80 needs no new mapping

Its sextants are already mapped algorithmically onto `U+1FB00`… by
`sextantGlyph()`. The palette reads that same function, so the table cannot
drift from the charset. `0x80` is excluded for the same reason the Spectrum's
blank is: it renders as a space.

## Known limitations

- CPC `0x80` stays reachable only as a numeric escape, as the Spectrum's blank
  does. The audit reports it.
- Neither machine's palette can be checked against a ROM key table the way the
  Sinclair ones were, because neither ROM maps a key to a graphics code. The
  absence is what the character-code labelling encodes.
