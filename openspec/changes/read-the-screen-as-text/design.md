## Context

The machine boundary and how a program reaches it are described in
`docs/contributing/architecture.md`; this design only covers one new question
asked across it.

Nothing in the application can read a screen. The only display a machine exposes
is `renderTo(canvas)`, which answers "what colour is this pixel" — the wrong
question for "what does it say". Everything else the IDE observes about a running
program (`readReport`, `readVariables`, `readMemoryStats`, `currentLine`,
`isProgramRunning`) is an optional member on `MachineEmulator`, detected by
`typeof`. There is no screen equivalent.

The knowledge exists, in the tests, out of bounds. Nineteen helper functions
across eighteen test files read a machine's screen back, and every one of them
reaches past the seam into a concrete emulator's internals — the exact coupling
the seam exists to prevent:

| Reached through | Files |
| --- | --- |
| `machine.processor.readmem(addr)` | 5 BBC, 3 Atom |
| `machine.mem.read(addr)` / `.readWord` | 1 ZX80, 2 Spectrum |
| `machine.mem.readScreen(addr)` | 2 CPC, 1 Spectrum 128 |
| `machine.readMemory(...)` / direct array | 4 Commodore |
| `machine.interpreter.screen.video` | 1 TRS-80 |

They disagree in shape (`string`, `string[]`, `number[]`, one row, one cell),
they each invent their own byte→character table rather than using the dialect's,
and each new machine adds another. The proposal says nine; the accurate count is
nineteen, and two of them (`findPlayer` on the ZX80 and the Atom) scan the screen
for a glyph rather than returning text at all.

Three quite different things are called "the screen" across the thirteen
registered machines, which is the fact that shapes this design:

- **A character matrix in RAM** — Acorn (mode 7), Commodore, Atom, TRS-80. The
  bytes are codes; a table turns them into characters.
- **A display file** — ZX80 and ZX81. Character codes again, but the rows are
  variable-length, `HALT`-terminated, and a blank row may be one byte.
- **A bitmap and nothing else** — the two Spectrums, the two CPCs, and the Acorn
  machines in modes 0–6. The characters are gone; they exist only as pixels that
  happen to match a font glyph.

## Goals / Non-Goals

**Goals:**

- One way to ask any machine for its screen as characters, through the seam.
- Every registered machine answers it, including the ones that must recover
  characters from pixels.
- The tests stop reaching around the seam and become the reader's first consumer,
  which is what proves it right.
- Characters come from the dialect's own charset, so a screen read and a listing
  agree about what a byte means.

**Non-Goals:**

- Pixels, colour, attributes, cursor position. Characters only.
- Writing to the screen.
- A required seam member. A machine that cannot answer omits it.
- Any consumer in the assistant or the UI. That is `assert-program-results`;
  this change stops at "readable, and the tests read it".

## Decisions

### One optional member, additive to the seam

```ts
readScreenText?(): MachineScreenText | null;

interface MachineScreenText {
  /** Fixed-width rows, top to bottom; every row is `cols` characters. */
  lines: string[];
  cols: number;
  rows: number;
}
```

**Seam impact: purely additive.** No existing member changes shape or meaning;
`Dialect` is untouched; detection is `typeof machine.readScreenText ===
'function'`, the same as the five optional members already there. A machine that
does not implement it keeps working with no edit.

Alternatives rejected:

- **A single `\n`-joined string.** Cheaper to assert against, but it throws away
  the geometry a caller needs to say "row 3, column 10", and makes a trailing
  blank row indistinguishable from a missing one. Callers that want a string
  join `lines`.
- **Right-trimmed rows.** Convenient for `toBe('HELLO')`, wrong as a contract:
  column positions stop meaning anything, and a 22-column VIC-20 row becomes
  indistinguishable from a 40-column one. Tests trim at the assertion.
- **Returning codes rather than characters.** The caller would then need the
  machine's encoding to make sense of them, which is exactly the coupling being
  removed.

### `null` means "cannot determine now", not "nothing on screen"

A blank screen is `cols × rows` spaces. `null` is reserved for the machine not
being able to answer *at this moment*: mid-boot before the ROM has set its screen
up, mid-`loadProgram`, after `dispose`, or in a display mode the reader cannot
decode. This mirrors `readMemoryStats`, which returns `null` while its pointers
are implausible rather than reporting a wrong figure, and it is what the spec's
"fall back gracefully rather than showing stale data" asks for.

### Characters come from the dialect charset, not a new per-machine table

Each of the nineteen test helpers has its own byte→character mapping, and they
disagree: the Atom helper folds `0x00–0x1F` up to ASCII, the BBC helper passes
`0x20–0x7E` through and blanks the rest, the ZX80 helper hand-maps two ranges and
emits `?` for everything else. The project already owns this mapping once per
charset family in `src/dialects/charsetProbes.ts` (`decodeSpan` / the per-dialect
`charset` modules), pinned by tests, and used by the reference pages and the
porting analyser.

So a reader's job is: get the screen *codes* (per machine), convert screen code →
charset byte (per machine, and the identity on most), then decode with the
dialect's own `decodeSpan`. Graphics blocks then come back as the same Unicode the
listing shows, which the semigraphics work already settled, instead of `?`.

The one wrinkle is that the Commodore machines and the Atom store *screen* codes,
not charset codes. `glyphSources.petsciiToScreen` already maps one direction for
the Commodores; the reader needs the inverse, which is a small addition beside it
rather than a new table per machine.

### Three implementations, not thirteen

| Machine | Source | Geometry |
| --- | --- | --- |
| BBC Micro, BBC Master | mode 7: teletext RAM; modes 0–6: bitmap OCR | per MODE |
| C64 | screen matrix at the VIC-II base | 40×25 |
| PET | screen matrix at `$8000` | 40×25 |
| VIC-20 | screen matrix at `$1E00` | 22×23 |
| Atom | VDG matrix at `$8000` | 32×16 |
| TRS-80 | the interpreter's video array | 64×16 |
| ZX80, ZX81 | display-file walk from `D_FILE` | 32×24 |
| Spectrum, Spectrum 128 | bitmap OCR against the ROM font | 32×24 |
| CPC 464, CPC 6128 | bitmap OCR against the lower-ROM font | per MODE |

The bitmap machines share one helper — a font-signature matcher that takes a map
from eight-byte glyph signature to character code, and a per-machine supplier of
one cell's eight 1-bpp mask bytes. That is exactly the shape the Spectrum test
(`fontSignatures` + `bitmapAddr`) and the CPC test (`sigToChar` + `decode`)
already converged on independently; the CPC's 2-bpp unpacker becomes the
"supplier" argument rather than a second copy of the matcher. It lives beside the
other cross-machine emulator utilities in `src/emulator/`, not in a dialect
folder, because four dialects across two CPU families use it.

### Screen bases are derived, never constants

Three of these machines move their screen out from under a hard-coded address:
the C64's matrix follows the VIC-II register, the VIC-20's follows the VIC-I
registers, and the Acorn machines' follows both the MODE and hardware scroll. The
existing test helpers get away with constants because they only ever look at a
freshly booted machine. A reader used after an arbitrary program has run cannot,
so each reader derives its base from the machine's own registers or system
variables, with a test that scrolls or re-`MODE`s the screen and still reads it
back.

### The Acorn machines answer in every mode

MODE 7 is a character matrix and trivially readable, and it is where the Acorn
machines boot — but the bundled samples alone use MODE 1, MODE 2 and MODE 6, so a
mode-7-only reader would answer `null` for most real programs. The MOS keeps the
current screen mode in its VDU variables; the reader reads it, takes the teletext
path for 7, and otherwise OCRs the bitmap with the MOS font and that mode's
geometry and pixel depth (1, 2 or 4 bpp). Modes 3 and 6 have blank scanline gaps
between character rows, which the geometry accounts for.

Every address and layout here — the VDU variable holding the mode, the font base,
the per-mode geometry — is confirmed against the real ROM and primary
documentation during implementation and pinned by a test, not taken from memory.
The same goes for the CPC's font base and the Atom's VDG code layout.

### The tests migrate, and that is the proof

The nineteen helpers are deleted and their assertions re-expressed against
`readScreenText()`. This is the change's real test: each helper encodes what its
machine's screen genuinely looks like after a known program, so a reader that
reproduces all nineteen sets of expectations is right for reasons other than its
own author's belief.

Two kinds of helper do **not** migrate, and keeping them is deliberate:

- `screenCodes(machine)` in the Atom semigraphics test and `screen(m)` in the
  Commodore tests return raw codes and are compared against a code list. They are
  assertions about the machine's *encoding*, not about text, and turning them
  into text assertions would delete the thing they test.
- `screenMem(rows)` in the C64 report test builds a fake screen as input. It is
  not a reader.

`findPlayer` on the ZX80 and the Atom scans for a glyph; both become a search
over `lines` and lose their private decoders.

## Risks / Trade-offs

- **OCR is ambiguous.** A blank cell and a space share a signature, as do some
  graphics glyphs. → The matcher keeps the first code that claims a signature,
  scanning from `0x20`, so a space wins over a blank graphic; unmatched cells
  read as a space rather than `?`, so a screen full of graphics reads as blank
  rather than as noise. The Spectrum test's existing `?` behaviour becomes a
  space, which its assertions (`toContain('1982 Sinclair')`) survive.
- **A redefined font defeats OCR.** A program that POKEs its own glyphs, or a
  BBC `VDU 23` UDG, reads back as blanks. → Accepted and documented on the seam
  member: OCR machines report what the *stock* font says. The character-matrix
  machines are unaffected, and this is a property of the hardware, not of the
  implementation.
- **Nineteen tests move at once.** A subtle reader bug shows up as a wall of
  failures with no obvious first cause. → Land each reader with its own colocated
  test against a known program *before* migrating that machine's existing tests,
  so a failure during migration is a genuine disagreement between the new reader
  and an old expectation, and the machines migrate one at a time.
- **The Acorn multi-mode path is the largest single piece.** Seven geometries and
  three pixel depths. → If a mode resists verification against the real ROM, that
  mode returns `null` (an honest "cannot determine") rather than guessed text,
  and the gap is recorded rather than papered over.
- **Cost.** OCR over a full screen is a few thousand map lookups. → It is called
  on demand, never per frame; no caller in this change is in the render loop.
- **The display-file walk has no fixed row length.** A ZX81 blank row is a single
  `HALT` byte, and a collapsed display file can be shorter than 24 rows. → The
  walk pads each row out to 32 characters and the file out to 24 rows, so the
  contract's fixed geometry holds whatever the ROM stored.
- **The Spectrum 128's screen can be either RAM page 5 or page 7.** → Read through
  the machine's own `mem.readScreen`, which already resolves the shadow-screen
  bit, rather than through raw page 5.
