## Context

Two dialects are in scope: BBC Micro and BBC Master. See
`docs/contributing/architecture.md` for the layering and
`docs/contributing/semigraphics-support.md` for the derived matrix this change
moves. The `semigraphics-unicode-palette` change built the mechanisms and
`amstrad-tandy-semigraphics` added the one the BBC needs — a palette cell
labelled by character code where no key exists. This document covers only what
is specific to the BBC pair.

The Master reuses the Micro's charset, tokenizer and keyboard layout wholesale
(`src/dialects/bbcmaster/index.ts` imports them), so one implementation moves
both rows of the matrix.

## Impact on the Dialect / MachineEmulator seam

**None.** Character representation stays behind `CharsetMapping`; the palette
stays data on `KeyboardLayout`; palette cells keep emitting the same
`EditorKeyAction { insert }` a key does. No new field on `Dialect`, no change
to `MachineEmulator`.

## Decisions

### The mosaic range is 64 codes, not the 96 currently declared

`SEMIGRAPHIC_CODES` declares `0xA0`–`0xFF`, citing the charset's own comment.
The SAA5050 disagrees: a character code is a mosaic **iff bit 5 is set**
(`%xx1xxxxx`), and codes with bit 5 clear stay text — in graphics mode the
capitals `0x40`–`0x5F` "blast through" as letters. In the top-bit byte space
BBC strings use for graphics, that makes the mosaics `0xA0`–`0xBF` and
`0xE0`–`0xFF`, with `0xC0`–`0xDF` displaying as capitals everywhere.

Sources, in the order the project trusts them:

- The teletext character-set specification (level 1), as recorded at
  `mdfs.net/Info/Comp/Teletext/Controls`: graphics are `%xx1xxxxx`; the 2×3
  cell takes top-left from bit 0, top-right bit 1, middle-left bit 2,
  middle-right bit 3, bottom-left bit 4, bottom-right **bit 6** (bit 5 is the
  graphics flag, so it is skipped).
- The SAA5050 implementation the IDE itself ships — jsbeeb's
  `src/teletext.js`, whose glyph builder constructs mosaics only for
  `!(c & 32)` and lights the six cells from bits 1, 2, 4, 8, 16 and **64**.
  What the editor claims is a mosaic is exactly what the emulator pane will
  draw as one.

A crosscheck test derives the shapes from jsbeeb's own glyph tables (in the
spirit of `src/dialects/sinclairGraphics.test.ts`, which checks Sinclair
spellings against the ROM): for every declared mosaic byte, the cells our
sextant character claims are lit are the cells jsbeeb lights, and
`0xC0`–`0xDF` render identically to their letter glyphs. The declaration
cannot drift from the emulator.

### Mosaics decode unconditionally

On the machine, whether `0xE1` shows as a sixel or as a letter depends on the
graphics-colour control code in force on the row — and on the mode, `HOLD
GRAPHICS` state, and whatever the program poked. A charset decode sees none of
that; `CharsetMapping` is deliberately stateless (a byte's spelling cannot
depend on distant bytes without breaking editing, search, and the palette).

So the graphics form is the canonical form, always. The risk is cosmetic
only: a top-bit byte meant as MODE 7 text shows in the editor as the mosaic
that shares its byte — while today it shows as `{0xNN}`, which taught the user
nothing either. Round-trips stay byte-exact, and `{0xNN}` input keeps
working, so nothing saved stops loading.

Rejected alternatives:

- **Context-aware decode** (track graphics state per row): the state is not
  knowable from the bytes — it also depends on the screen mode and on codes
  printed at run time — and a spelling that changes when a distant byte is
  edited breaks the one-byte-one-character editing guarantee.
- **Named `{MOSAIC nn}` escapes**: honest but unreadable; teletext art stays
  a wall of escapes and the palette would insert seven characters per cell.

### The sextant mapping is shared with the TRS-80, not duplicated

The TRS-80's `sextantGlyph()` (`src/dialects/trs80/charset.ts`) already maps a
six-bit cell pattern to `U+1FB00`… with the four patterns Unicode keeps
elsewhere (left half, right half, full block — and blank, which stays
unmapped). The BBC's cells arrive in a different bit order, so the BBC side is
one permutation away:

```
sextant pattern = (code & 0x1F) | ((code & 0x40) >> 1)
```

`sextantGlyph()` moves to a shared module at the `src/dialects/` root (the
`sinclairCharset.ts` precedent for cross-dialect sharing), and both charsets
read it, so the two machines' sextants cannot drift apart.

### The palette teaches `CHR$`, in two banks

No BBC keycap carries a graphic — MODE 7 art was written with `CHR$(n)` (or by
editors poking screen memory) — so every cell is labelled with its decimal
character code, the form `GraphicEntry` without `key` already renders. The
palette lists the two banks in byte order (`0xA1`–`0xBF`, then
`0xE0`–`0xFF`), matching how the codes appear in listings.

`0xA0` is excluded for the reason the Spectrum's blank is: it renders as a
space, so a cell for it would appear to insert nothing. It stays a named
`notText` entry in the round-trip test.

### Tokenizer literals learn astral characters

The sextants live outside the BMP, so the BBC tokenizer's literal path (and
the expression path's error reporting) must consume full code points rather
than UTF-16 units, as `src/dialects/trs80/tokenizer.ts` already does. This is
the only tokenizer change; keywords and tokens are untouched.

## Known limitations

- A top-bit byte used as MODE 7 *text* displays in the editor as its mosaic
  twin. The spec delta records this as the intended behaviour; the support
  doc's "known wrinkles" explains it to contributors.
- `0xA0` (empty mosaic) stays reachable only as `{0xA0}`, joining the three
  machines whose blank cell has the same gap.
- The palette cannot be checked against a ROM key table, because no BBC key
  produces a graphics code — the absence is what the `CHR$` labelling encodes.
