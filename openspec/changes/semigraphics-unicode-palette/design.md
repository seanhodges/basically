## Context

Seven dialects are in scope: ZX80, ZX81, ZX Spectrum 48K, ZX Spectrum 128,
Commodore 64, VIC-20 and PET. See `docs/contributing/architecture.md` for the
overall layering; this document covers only what is specific to semigraphics.

## Impact on the Dialect / MachineEmulator seam

**None.** Every part of this change flows through seams that already exist:

- Character representation stays behind `CharsetMapping` (`toMachine`,
  `toUnicode`, `glyph`) — only the tables behind it change, and only for the
  Sinclair dialects.
- The palette is expressed as data on `KeyboardLayout`, exactly as key layers
  are today, so `VirtualKeyboard` and `KeyboardInputEngine` stay machine-
  agnostic. Palette cells emit the same `EditorKeyAction { insert }` a key does,
  so the input engine and the editor/emulator routing are untouched.
- No new field on `Dialect` beyond what `keyboardLayout` already carries, and no
  change to `MachineEmulator`.

## Decisions

### Unicode is the canonical form, escapes stay readable

The five ZX81 grey characters (and the ZX80 equivalents) move from backslash
escapes to their Symbols-for-Legacy-Computing characters. `toUnicode` starts
emitting the character; `toMachine` keeps accepting the old escape. This is
deliberately asymmetric: it makes the canonical form uniform without invalidating
a single saved program.

The exact code points must be confirmed against the Unicode character database
before coding, per the project's rule that machine behaviour comes from primary
sources rather than memory.

Consequence: the published escape tables for those two machines change, and the
escape crosscheck test fails until they are updated. That is the pin doing its
job, not a regression.

### The palette replaces the graphics key layers rather than joining them

Keeping both would mean two places to add a character and two things to keep in
sync with the charset. The graphics layers on ZX80, ZX81, C64, VIC-20 and PET are
removed and their GRAPHICS mode switches to the palette.

A useful side effect: the component's "which layer does this mode pin" helper
hard-codes a modifier named `shift`, which the Spectrum does not have (its
modifiers are `caps` and `symbol`). With graphics modes no longer pinning a
layer, that mismatch never arises and no generalisation is needed.

### One table per dialect feeds both the palette and the charset

The Commodore dialects already prove the pattern: a single table of
`{ key, char, code }` is read by the keyboard for its legends and by the charset
for its mapping, so the two cannot drift. The Spectrum gets the same treatment,
and its charset's graphics table is derived from it rather than written twice.

### Visually-identical Commodore characters keep their keys

A few Commodore graphics have character-ROM bitmaps identical to a lower code
(`C= H`, `C= N`, `SHIFT −`). Because the charset is injective — one text form per
byte — those cannot have their own Unicode character; their character tokenizes
to the primary twin.

They stay in the palette, labelled with their real key, and insert the canonical
byte. On screen the result is identical, and the alternative (hiding them) would
make the palette disagree with the physical keyboard it is supposed to teach. The
round-trip test carries them as a named allowlist so the drift is asserted rather
than discovered.

### A derived audit rather than a written one

What each dialect can represent is computed from its own `CharsetMapping`, and
what it can type is computed by walking its keyboard layout and palette through
the same charset. Only the machines' real graphics byte ranges are written by
hand, each cited to a primary source. The generated matrix is pinned by a test
that regenerates and diffs, so the document cannot drift from the code.

The same derivation produces the code point list the font subset is built from,
so the font and the audit cannot disagree about what needs covering.

### Font: a gated fallback, not a replacement editor font

The bundled face is restricted by `unicode-range` to the graphics blocks and
deliberately excludes ASCII, so it can sit first in the font stack without ever
being consulted for ordinary text. Its metrics are pinned to the primary font's
with the `size-adjust` / `ascent-override` / `descent-override` /
`line-gap-override` descriptors, because the editor measures line height from
rendered content — an unpinned fallback would change row heights the moment a
graphic appears and desynchronise the gutter and line decorations.

Only a subset is redistributed, and the source font must be under a licence
compatible with GPL-3.0-or-later with attribution recorded alongside the file, as
the bundled ROMs already do.

## Known limitations

- **Stacked graphics do not tile vertically.** Seamless tiling needs the line
  height to equal the character cell height; the editor's line height is larger.
  This is a property of the CSS line box, not the font, so no font choice fixes
  it. Accepted and documented.
- **The palette is reachable only through the on-screen keyboard.** Someone
  typing on a physical keyboard must open it to reach the grid.
