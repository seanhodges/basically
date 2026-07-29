## Context

One dialect is in scope: the Acorn Atom. See
`docs/contributing/architecture.md` for the layering and
`docs/contributing/semigraphics-support.md` for the derived matrix this change
moves. The mechanisms all exist already — `semigraphics-unicode-palette` built
the palette, `amstrad-tandy-semigraphics` added the code-labelled cell for
machines with no graphics keycaps, and `bbc-mode7-semigraphics` factored
`sextantGlyph()` out into `src/dialects/sextants.ts` and established the shape
of exactly this change. This document covers only what is specific to the Atom.

The research is done and written up in
`docs/contributing/dialect-plans/atom-semigraphics.md`; the facts below are
cited from it rather than re-derived. That file is deleted by this change, per
the `dialect-plans/` convention, so anything worth keeping is restated here or
in the code comments the tasks call for.

## Goals / Non-Goals

**Goals:**

- The Atom's 63 non-blank Semigraphics-6 cells have Unicode characters, are
  typeable from a palette, and survive editor → tokenizer → `.atm` → import
  byte-exactly.
- The declaration in `SEMIGRAPHIC_CODES` is pinned to the emulator the IDE
  ships, so it cannot drift from what the screen actually draws.
- The published Atom escapes page stops describing `0xA0`–`0xFF` as inverse
  video.

**Non-Goals:**

- Colour. The MC6847's two Semigraphics-6 colour sets are the same 64 shapes
  in different hues; editor text carries shape only.
- The poke-only screen codes `0x40`–`0x5F`. They are reachable only by writing
  screen RAM, which is numeric literals in program text — not string bytes, so
  not something a `CharsetMapping` covers.
- Any change to Atom BASIC tokenization, keywords, or the emulator core.

## Impact on the Dialect / MachineEmulator seam

**None.** Character representation stays behind `CharsetMapping`; the palette
stays data on `KeyboardLayout`; palette cells keep emitting the same
`EditorKeyAction { insert }` a key does. No new field on `Dialect`, no change
to `MachineEmulator`, no change to the Atom emulator adapter.

## Decisions

### The graphics range is the program bytes `0xA0`–`0xDF`, established by probe

Atom BASIC has no `CHR$` and stores program lines as plain ASCII, so the
question was never "which screen codes are graphics" but "which **program-text
bytes** reach them". The answer came from running the genuine Kernel ROM
(`public/roms/atom/` through `AtomMachine`), PRINTing every byte `0x20`–`0xFF`
from a string literal and reading the raw screen codes back out of `#8000`.
The ROM's write-character routine maps `0xA0`–`0xDF` to screen codes
`0xC0`–`0xFF`, which the MC6847 draws as Semigraphics-6 patterns `0x00`–`0x3F`
— the complete 64-cell set. `0xE0`–`0xFF` maps to screen `0x60`–`0x7F`,
patterns `0x20`–`0x3F` again in the other colour set.

Unlike the BBC, there is no display-context ambiguity to decide away: the
kernel maps the byte to a graphics screen code unconditionally, with no
graphics-on control code and no blast-through range. So the declaration is a
flat 64 codes and the decode has no wrinkle to record.

Two things pin it in the repository rather than in this document:

- A **glyph-table crosscheck** against `makeCharsAtom()` in jsbeeb's
  `src/6847_fontdata.js` — the MC6847 mask-ROM font the IDE's own emulator
  draws with. For every declared byte, the six cells our sextant character
  claims are exactly the cells the emulator lights. Same spirit as
  `src/dialects/bbcmicro/mode7Graphics.test.ts` and
  `src/dialects/sinclairGraphics.test.ts`.
- A **kernel-ROM probe test**, since the machine tests already boot the real
  ROM: PRINT the byte, read `#8000`, assert the screen code. The probe that
  produced the finding becomes the test that defends it.

Rejected: declaring the range from the MC6847 datasheet alone. The datasheet
says what SG6 is, but not which program byte the Atom's kernel routes there —
which is the fact that decides whether the editor can offer these at all.

### The cell order is a six-bit reversal of Unicode's

Read out of the same glyph table: the MC6847 numbers the cells **bit 5
top-left, bit 4 top-right, bit 3 middle-left, bit 2 middle-right, bit 1
bottom-left, bit 0 bottom-right** — the exact reverse of the order
`sextantGlyph()` expects. So the mapping is

```
character = sextantGlyph(reverse6(code - 0xA0))
```

where `reverse6` reverses a six-bit value. The BBC needed a bit *permutation*
for the same reason; sharing `sextantGlyph()` keeps the three machines' sextant
spellings from drifting apart, and the reversal stays local to the Atom charset
where the crosscheck test can see it.

The paper datasheet's L5…L0 layout agrees with this reading, but the scanned
copy was not OCR-readable during the research. The glyph table and the rendered
emulator output are authoritative for what the IDE shows either way, and the
crosscheck test is against those — so this is not an open question for the
implementation, only a citation that stays second-hand.

### `0xE0`–`0xFF` keep their escapes: injectivity beats coverage

The Atom is the first machine where two *different bytes* draw the *same
shape*: `0xE0 + n` and `0xC0 + n` are pattern `0x20 + n` in the two colour
sets. The charset is total and injective — every byte has exactly one text
form and that form re-encodes to that byte — which is what makes editing,
search and the palette behave. Giving both bytes the sextant would break it;
whichever one lost the re-encode would silently corrupt on save.

So the lower byte of each pair keeps the character (it is the one inside the
contiguous 64-code range the kernel probe established) and `0xE0`–`0xFF` stays
`{0xNN}`. The Commodore machines solved a similar collision with named twins,
which stays available if the palette ever wants the second colour set, but
there is no demand for it: the shapes are identical and the colour that
distinguishes them is not in the text.

This is the one behavioural fact the baseline spec does not yet state, so it is
this change's spec delta.

### The palette teaches the byte, in one bank

No Atom keycap prints a graphic, and Atom BASIC has no `CHR$` — a program
reached these by putting the byte in a string literal, which in the IDE means
typing it. So every cell is labelled with its character code, the form
`GraphicEntry` without `key` already renders, and the palette is one section in
byte order (`0xA1`–`0xDF`). Entries come from the charset's own decode, so the
palette and the mapping cannot disagree.

`0xA0` is excluded for the reason the Spectrum's, TRS-80's, CPC's and BBC's
blanks are: it draws an empty cell, its faithful text form would be a space,
and a cell that appears to insert nothing is worse than no cell. It stays a
named `notText` entry in the round-trip test.

### The spec delta stacks on `bbc-mode7-semigraphics`

That change is implemented but not yet archived, and it modifies the same
requirement. This change's `MODIFIED Requirements` block therefore quotes the
requirement **as `bbc-mode7-semigraphics` leaves it** (including its
context-dependent-byte paragraph) plus the same-shape paragraph, so whichever
order the two archive in, the baseline ends up with both. If the BBC change is
archived first this is already the current baseline text; if it is not, the
delta still carries the full requirement, which is what archiving needs.

## Risks / Trade-offs

- **The colour distinction disappears from the text.** A program that used the
  `0xE0`–`0xFF` bank for its second colour set still round-trips byte-exactly
  and still runs in colour — it just reads as `{0xNN}` in the editor rather
  than as a shape. → Recorded in the support doc's "known wrinkles" and in the
  escapes page, next to the Spectrum/TRS-80/CPC blank-cell entry.
- **The declared range depends on a kernel-ROM behaviour, not a datasheet.**
  A different Atom ROM revision could in principle map WRCH differently. → The
  probe test runs against the ROM the IDE actually ships, so the declaration is
  true of the machine the user gets; a ROM swap would fail the test rather than
  drift silently.
- **The bit-reversal is easy to get backwards** and a mirrored sextant is not
  obviously wrong at a glance. → The crosscheck test compares against the
  emulator's own glyph bitmaps cell by cell, which catches a reversal.
- **`0xA1`–`0xDF` stop being escapes**, so an Atom program saved with `{0xC1}`
  now shows a sextant. → Intended (it is what the machine draws), the escape
  still loads and still encodes to the same byte, and the escapes page is
  corrected in the same change.

## Open Questions

None. The one item the research left open — confirming the SG6 cell order
against the paper datasheet rather than the emulator — does not gate the
implementation: the IDE must match the emulator it ships, and the crosscheck
test enforces exactly that.
