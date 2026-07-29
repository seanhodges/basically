# Acorn Atom semigraphics: research findings

Status: research complete, change not yet proposed. This note resolves the
"not established from a primary source" row the Atom holds in
`docs/contributing/semigraphics-support.md` (see `SEMIGRAPHIC_CODES.atom` in
`src/dialects/semigraphicsAudit.ts`, deliberately `null` until now). It
records what was established and recommends the shape of the follow-up
change. Per this directory's convention, delete this file in the change that
implements (or explicitly declines) that work.

## The question

The Atom's charset treats every byte `0x80`–`0xFF` as MC6847 inverse video
and spells it `{0xNN}`. Its chunky graphics were known to exist but not where
they sit — and, more fundamentally, whether any **program-text byte** (Atom
BASIC stores plain ASCII; there is no CHR$) reaches them through `PRINT` at
all, or whether they are poke-only (`?#8000=n` with _screen_ codes, which are
numeric literals in program text, not string bytes).

## What was established

### The graphics are Semigraphics 6 sextants

The Atom wires the MC6847's AS/INT-EXT pins to screen-data bit 6 and INV to
bit 7 (recorded in jsbeeb's `src/6847.js`, from the Atom schematic), so in
text mode a screen byte with bit 6 set is a **Semigraphics 6** cell: a 2×3
block, six cells, 64 patterns — the same shape family as the TRS-80's and the
BBC's mosaics, already mapped by `sextantGlyph()` in
`src/dialects/sextants.ts`. Screen codes `0x40`–`0x7F` are the 64 patterns in
one colour set, `0xC0`–`0xFF` the same 64 patterns in the other (bit 7 picks
the colour pair; colour is not representable in editor text and can be
ignored, but shape-duplicate codes matter for injectivity, below).

The cell order was read out of the glyph table the IDE's own emulator draws
with (`makeCharsAtom()` in jsbeeb's `src/6847_fontdata.js`, mirroring the
MC6847 mask ROM): **bit 5 top-left, bit 4 top-right, bit 3 middle-left,
bit 2 middle-right, bit 1 bottom-left, bit 0 bottom-right** — the exact
reverse of the Unicode sextant bit order, so the permutation into
`sextantGlyph()` is a six-bit reversal. Pattern `0x00` is blank and `0x3F`
the full block, consistent with the SG6 description in the MC6847 datasheet
(six luminance bits L0–L5, two colour bits). An implementation should pin
this with a glyph-table crosscheck test, the way
`src/dialects/bbcmicro/mode7Graphics.test.ts` pins the BBC mapping against
jsbeeb's SAA5050.

### PRINT does reach them: the kernel WRCH mapping, probed

The decisive fact came from running the **genuine Atom Kernel ROM**
(`public/roms/atom/` via `AtomMachine`) and PRINTing every byte `0x20`–`0xFF`
from a BASIC string literal, then reading the raw screen codes back out of
`#8000`. The ROM's write-character routine maps:

| Program (string) byte | Screen code              | Display                                          |
| --------------------- | ------------------------ | ------------------------------------------------ |
| `0x20`–`0x3F`         | `0x20`–`0x3F` (identity) | digits / punctuation                             |
| `0x40`–`0x5F`         | `0x00`–`0x1F` (−0x40)    | capitals                                         |
| `0x60`–`0x7E`         | `0x80`–`0x9E` (+0x20)    | inverse capitals (the machine has no lower case) |
| `0x7F`                | —                        | destructive delete (control)                     |
| `0x80`–`0x9F`         | `0xA0`–`0xBF` (+0x20)    | inverse digits / punctuation                     |
| `0x80`–`0xDF`         | `0xA0`–`0xFF` (+0x20)    | …continuing into:                                |
| **`0xA0`–`0xDF`**     | **`0xC0`–`0xFF`**        | **SG6 patterns `0x00`–`0x3F`, complete**         |
| `0xE0`–`0xFF`         | `0x60`–`0x7F` (−0x80)    | SG6 patterns `0x20`–`0x3F` again, other colour   |

So the Atom's graphics **are** program bytes: `PRINT` of string byte
`0xA0 + p` always draws SG6 pattern `p` (`0xA0` is the blank — the same
"blank cell nobody can type" the Spectrum, TRS-80, CPC and BBC record).
Unlike the BBC there is no display-context ambiguity to decide away: the
kernel maps the byte to a graphics screen code unconditionally. Screen codes
`0x40`–`0x5F` (patterns `0x00`–`0x1F` in the first colour set) are reachable
only by poking, which does not affect the program-byte declaration.

## Recommended follow-up change

A small change on the pattern `bbc-mode7-semigraphics` established:

- **Declare** `SEMIGRAPHIC_CODES.atom = 0xA0–0xDF` (64 codes), citing the
  kernel-ROM probe and the glyph-table crosscheck.
- **Map** `0xA1`–`0xDF` to `sextantGlyph(reverse6(byte − 0xA0))` in
  `src/dialects/atom/charset.ts`; `0xA0` stays `{0xA0}` (blank). `{0xNN}`
  keeps loading. Every code point is already in the bundled font.
- **Leave escaped**: `0x80`–`0x9F` (inverse punctuation — no Unicode form)
  and `0xE0`–`0xFF` (shape-duplicates of `0xC0`–`0xDF` in the other colour;
  injectivity forbids a second spelling — either escaped, or Commodore-style
  named twins if the palette wants them).
- **Palette**: code-labelled cells (no Atom keycap prints a graphic), two
  editor-mode additions in `src/dialects/atom/keyboardLayout.ts`, entries
  from the charset's own decode.
- **Crosscheck test** against `makeCharsAtom()` glyphs, and a WRCH probe test
  is possible against the real ROM (the machine tests already boot it).
- Audit/round-trip/doc updates as in the BBC change (IN_SCOPE,
  `e2e/paletteMachines.ts`, `semigraphicsRoundTrip.test.ts` with the `.atm`
  target, `npm run gen:semigraphics`, escapes reference page).

One open item to confirm during implementation, from the paper datasheet
rather than the emulator: the SG6 cell order above matches the MC6847
datasheet's L5…L0 layout (the scanned datasheet was not OCR-readable during
this research; the glyph table and the rendered emulator output are
authoritative for what the IDE shows either way).
