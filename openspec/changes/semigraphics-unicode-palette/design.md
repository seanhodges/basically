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

### The Spectrum's graphics-mode keys, derived from the ROM

Established by reading `K-DECODE` out of `public/roms/zxspectrum.rom`. Driving
the emulator turned out to be unnecessary: the routine is short enough to decode
directly, and the ROM bytes are the primary source either way. Recorded here so
the table in `zxspectrum/graphics.ts` can cite a derivation rather than assert a
mapping.

On entry `C` holds `MODE` (0 = K/L/C, 1 = E, 2 = G), `E` holds the character from
the main key table at `0x0205` — which stores letters **uppercase** — and `B` is
`0xFF` when no shift is held.

**Letters become user-defined graphics.** The graphics-mode branch of the mode
dispatch at `0x0333` is a single instruction, `ADD A,$4F` at `0x033E`:

```
0338  DEC C
0339  JP M,$034F      ; MODE 0: ordinary letter
033C  JR Z,$0341      ; MODE 1: extended
033E  ADD A,$4F       ; MODE 2 (graphics)
```

So `code = uppercase ASCII + 0x4F`: `A` (0x41) becomes `0x90` and `U` (0x55)
becomes `0xA4`. Twenty-one letters onto exactly the twenty-one user-defined
graphics codes, ending precisely on the `UDG_LAST` the charset already declares.

**Digits become block graphics.** At `0x0389`, reached when `MODE` is 2:

```
038C  CP $39 / JR Z   ; '9' and '0' are handled elsewhere
0390  CP $30 / JR Z   ; (mode toggle and delete)
0394  AND $07
0396  ADD A,$80       ; code = 0x80 + (ASCII & 7)
0398  INC B
0399  RET Z           ; unshifted: done
039A  XOR $0F         ; shifted: complement the quadrant bits
039C  RET
```

`ASCII & 7` maps `'1'`–`'7'` to 1–7 and **`'8'` to 0**, and `XOR $0F`
complements all four quadrant bits, which is exactly inverse video:

| Key | Plain | CAPS SHIFT |
| --- | --- | --- |
| 1 | `0x81` ▘ | `0x8E` ▟ |
| 2 | `0x82` ▝ | `0x8D` ▙ |
| 3 | `0x83` ▀ | `0x8C` ▄ |
| 4 | `0x84` ▖ | `0x8B` ▜ |
| 5 | `0x85` ▌ | `0x8A` ▐ |
| 6 | `0x86` ▞ | `0x89` ▚ |
| 7 | `0x87` ▛ | `0x88` ▗ |
| 8 | `0x80` blank | `0x8F` █ |

Eight keys times two shift states cover all sixteen codes exactly once. Note that
**key 8 carries the blank and the solid block** rather than a quadrant — the one
assignment nobody would guess from the keycaps, and the reason this had to come
from the ROM rather than from the manual's picture of the keyboard.

The ROM complements on any shift reaching that point, but CAPS SHIFT is the
documented modifier and is what the palette should show as the key hint.

The table can therefore be pinned without running the machine: it is a bijection
onto `0x80–0x8F`, each shifted entry is its unshifted partner's complement
(`code ^ 0x0F`), and every entry's character round-trips through the charset. A
test that drives the emulator would confirm this rather than establish it.

### The ZX81's graphics-mode keys, derived from the ROM too

The ZX81 table was first taken from the shapes the old key legends drew, and two
of them (E and R, the three-quarter blocks ▛ and ▜) carried each other's shape.
The ROM settles it, the same way the Spectrum's did.

Its keyboard tables are three 39-entry blocks in matrix-scan order, indexed by
the same `E` the decode carries: the unshifted characters at `0x007D+E`, the
shifted ones at `0x00A4+E` (a shifted key is `E` + 39, which is why one base
serves both), and the graphics ones at `0x00C7+E`. The graphics-mode branch at
`0x04DF` reads the key's character and, if it is below `0x40`, just sets bit 7 —
inverse video. A character of `0x40` or above (a token — what the shifted digit
and letter keys hold) indexes the graphics table instead.

So the twenty block graphics are exactly the shifted keys whose shifted meaning
is a token, plus the solid block, which is unshifted SPACE arriving as the
inverse of `0x00`. `zx81/graphics.test.ts` re-derives the whole table that way
and compares it with the palette's, so no entry can drift again.

### The Spectrum's user-defined graphics are one character each

A UDG has no shape of its own — its bitmap is whatever the program pokes into
UDG RAM — so the only thing to show is which UDG it is. Written as the `\a`–`\u`
escape it took two editor characters for one machine byte, which laid out as two
palette cells and let a backspace strand half of it in the program.

The squared capitals `U+1F130`–`U+1F144` (🄰–🅄) are exactly twenty-one
characters, one per UDG, name the key that types each, and are visibly not the
ordinary letter beside them. They are astral, so the charset reads whole code
points rather than UTF-16 units; the escape spelling stays accepted on input, so
nothing saved before stops loading.

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
