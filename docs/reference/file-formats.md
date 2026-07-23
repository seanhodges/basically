# File formats

Every dialect works with the same small set of file kinds, even though the
underlying bytes are completely different from machine to machine: a
plain-text editor format, a **native binary** that real hardware and
emulators load directly, and a **cassette audio** recording. Several machines
also read and write a block-carrying **disc image**. The native binary
doubles as the in-memory image the IDE's own emulator injects, and (for
dialects that support importing) as an import format that round-trips back to
editable source. The exact extensions for each machine are listed in the
[native binary formats](#native-binary-formats) table below.

This page is the cross-machine overview: the shared editor and project-bundle
formats, the escape-notation and machine-code-block concepts that apply across
dialects, and an index of the **per-machine format pages** where each
machine's native binary(s), disc image and cassette encoding are documented in
full.

## Editor source format (.bas)

Plain UTF-8 text, one BASIC line per text line: a line number followed by
exactly one statement. Keywords are written as words (`PRINT`, `GOTO`,
`INKEY$`, `**` for power). Lowercase input is folded to uppercase. The legal
line-number range and statement rules are dialect-specific (see each dialect's
language reference page).

To download the BASIC listing on its own, right-click (or long-press) the
**BASIC** tab above the editor and choose **Download .bas**. A machine-code or
data block tab offers the same for its own `.asm` (assembly source) and `.bin`
(raw bytes) files. Loading a plain `.bas` or `.txt` opens it straight into the
editor as source, so listings — including those saved by earlier versions —
still open unchanged.

## Project bundle (.zip)

**Save project** writes the whole document as a `.zip` bundle — a zip archive
that holds each part as its own file:

- `program.bas` — the BASIC source
- `blocks/<name>.bin` — each memory block's raw bytes
- `blocks/<name>.asm` — a machine-code block's assembly source
- `project.json` — a small metadata file naming the parts above and recording
  the machine the project was authored for, each block's load address and kind
  (code or data), any auto-start line, and any tape files preserved off a
  multi-part import

Because it's an ordinary zip, you can rename it, inspect it, or unzip it with
any archive tool to get at the parts directly.

Saving as a project means **memory blocks** — fixed-address machine code or data
that loads alongside the program (see
[Machine code & data blocks](#machine-code-data-blocks)) — and those preserved
tape files always travel with your program. **Open project** loads everything
back together, switching the active machine to the one the project was saved
for, and also accepts a plain `.bas`/`.txt` as source. Project bundles saved by
earlier versions with the `.bproj` extension still open. To get just the BASIC
listing on its own, use the editor tab's download action described above.

## Escape notation

Every dialect's charset is **total**: each byte 0x00–0xFF has a text form
that tokenizes back to the same byte, so imported programs never lose data
silently. Bytes with no printable glyph round-trip through dialect-styled
escapes (Sinclair `\{NN}`, Spectrum/BBC/TRS-80/Atom `{0xNN}`, C64 `{$xx}`,
plus named forms like `{INK 2}`, `{RED}` or `{clr}`), recognised in the
literal contexts where raw bytes live in a real program. Characters outside a
machine's set remain tokenizer errors.

Each dialect's full notation is a searchable table on its escape-codes
reference page:

- [ZX81 escape codes](./zx81/escapes) (zxtext2p-compatible where practical)
- [ZX80 escape codes](./zx80/escapes)
- [ZX Spectrum escape codes](./zxspectrum/escapes) (48K & 128K)
- [BBC escape codes](./bbc/escapes) (Micro & Master, teletext names)
- [Commodore 64 escape codes](./commodore64/escapes) (petcat-interoperable)
- [TRS-80 escape codes](./trs80/escapes)
- [Acorn Atom escape codes](./atom/escapes)

## Native binary formats

| Dialect            | Export         | Import         | What it is                                                         |
| ------------------ | -------------- | -------------- | ------------------------------------------------------------------ |
| ZX81               | `.P`           | `.P`           | RAM dump 0x4009 → E_LINE-1                                         |
| ZX80               | `.O`           | `.O`           | RAM dump 0x4000 → E_LINE-1                                         |
| ZX Spectrum / 128  | `.TAP`         | `.TAP`         | header + data tape blocks                                          |
| BBC Micro / Master | `.bbc`, `.ssd` | `.bbc`, `.ssd` | tokenized program from PAGE; `.ssd` disc adds code/data blocks     |
| Commodore 64       | `.prg`, `.d64` | `.prg`, `.d64` | load address + tokenized program from $0801                        |
| Commodore VIC-20   | `.prg`, `.d64` | `.prg`, `.d64` | load address + tokenized program from $1001                        |
| Commodore PET      | `.prg`, `.d64` | `.prg`, `.d64` | load address + tokenized program from $0401                        |
| TRS-80             | `.cas`, `.dsk` | `.cas`, `.dsk` | Model I CSAVE cassette block; `.dsk` JV1 disc adds code blocks     |
| Acorn Atom         | `.atm`, `.dsk` | `.atm`, `.dsk` | 22-byte header + `#2900` image; `.dsk` disc adds code blocks       |
| Amstrad CPC 464    | `.bas`, `.cdt` | `.bas`, `.cdt` | AMSDOS-headered tokenized program from &0170; `.cdt` firmware tape |

All of these are built by the IDE when you export; the ones that can also be
re-imported are marked in the Import column above. The
[serial bridge](./serial-protocol) sends whichever of these images belongs to
the active dialect.

Each machine's native binary, disc image and cassette encoding are documented in
full on its own page:

- [ZX81 file formats](./zx81/formats) — `.P`
- [ZX80 file formats](./zx80/formats) — `.O`
- [ZX Spectrum file formats](./zxspectrum/formats) — `.TAP` (48K & 128K)
- [BBC Micro / Master file formats](./bbc/formats) — `.bbc`, `.ssd`
- [Commodore 64 / VIC-20 / PET file formats](./commodore64/formats) — `.prg`, `.d64`
- [TRS-80 file formats](./trs80/formats) — `.cas`, `.dsk`
- [Acorn Atom file formats](./atom/formats) — `.atm`, `.dsk`
- [Amstrad CPC file formats](./cpc/formats) — `.bas`, `.cdt`

## Machine code & data blocks

Some programs load machine code or data at a fixed address alongside the BASIC
program. The IDE keeps these as named **memory blocks**; on Run they are written
straight into RAM before the program starts, and they travel with the document
through the [project bundle](#project-bundle-zip) and through
[share links](../guide/publishing). The ZX Spectrum `.TAP`, the Commodore `.d64`,
the BBC `.ssd`, and the Atom and TRS-80 `.dsk` disc images carry blocks in
**both directions** (see each machine's page —
[`.TAP`](./zxspectrum/formats#tap),
[`.d64`](./commodore64/formats#commodore-64-vic-20-pet-d64),
[`.ssd`](./bbc/formats#bbc-micro-master-ssd),
[Atom `.dsk`](./atom/formats#acorn-atom-dsk),
[TRS-80 `.dsk`](./trs80/formats#trs-80-dsk) — for the export layouts); several
native formats carry blocks on **import** only:

- **ZX Spectrum `.TAP`** — a tape holding CODE files (each with a load address)
  imports every CODE file as a block. A tiny `LOAD "" CODE … : RANDOMIZE USR n`
  loader chaining into a longer program is recognised: the loader is skipped
  (with a note) and the real program imported.
- **Commodore `.prg` / `.d64`** — a `.prg` whose load address is not the BASIC
  start ($0801 C64, $1001 VIC-20, $0401 PET) imports as a single block at that
  address; a normal program with extra bytes past the end of the tokenized
  program imports the program plus those trailing bytes as a block. A `.d64`
  disk image (C64, VIC-20 or PET) imports every non-BASIC file as a block.
- **BBC `.ssd`** — a DFS disc image imports the BASIC program (the file at PAGE)
  for editing and every other file as a block at its own load address, keeping
  its exec address for machine code (the generated `!BOOT` is skipped). See
  [`.ssd`](./bbc/formats#bbc-micro-master-ssd) for the matching export layout.
- **Acorn Atom `.atm`** — an `.atm` that loads somewhere other than `#2900`
  (where BASIC text lives) is a machine-code or data file, so its payload imports
  as a block at its load address, remembering the header's exec address.
- **TRS-80 `.cas`** — a machine-language SYSTEM cassette imports each of its
  address records as a block (the entry-point address stays with the block
  that contains it), and machine code trailing a BASIC program on the tape
  imports as a block at the address it followed the program.

A block can carry an **entry address** recovered with it (an Atom `.atm`'s
exec address, a TRS-80 SYSTEM tape's entry record). When a document holds no
BASIC program at all, a machine that can start machine code runs the block
from its entry address instead — the Atom starts it with `LINK`.

When you Run, the IDE checks each block against the machine's memory: a block
that would overlap the BASIC program is refused (Run reports which block), and a
block over live hardware such as the screen is allowed but flagged.

Every block-capable machine carries its blocks inside a container in **both
directions**: the BBC in a [`.ssd`](./bbc/formats#bbc-micro-master-ssd) disc (or
as inline assembly in the `.bbc`), the Commodore in a
[`.d64`](./commodore64/formats#commodore-64-vic-20-pet-d64), the ZX Spectrum in a
[`.TAP`](./zxspectrum/formats#tap), and the Acorn Atom and TRS-80 in a
[`.dsk`](./atom/formats#acorn-atom-dsk) disc image. The ZX81/ZX80 keep their
machine code inside the listing as `#BIN` REM records.

## Cassette audio

Dialects whose machines loaded from tape expose a `.wav` export (and "play
through speakers") **and** a cassette-audio import - listening on the mic /
line-in, or decoding a `.wav` recording, back into editable source. All
encoders emit mono 44.1kHz and offer a "robust" mode that lengthens the
leader/pilot for temperamental hardware.

The handling is dialect-agnostic: the IDE's Import / Export dialogs encode and
decode through the selected dialect and never need to know which machine is
loaded. Decoding is the exact inverse of encoding, recovering the machine's
program name (where the format carries one) and source text. Every decoder
estimates its bit timing
from the recovered signal rather than assuming absolute durations, so decoding
is immune to playback / clock speed drift, resampling and sample-rate mismatch.

Each machine's tape encoding is described in the **Cassette audio** section of
its format page:

- [ZX81](./zx81/formats#cassette-audio) / [ZX80](./zx80/formats#cassette-audio) —
  bytes MSB-first, 4/9-pulse bits; the ZX81 prefixes a program-name header, the
  ZX80 has no named files.
- [ZX Spectrum / 128](./zxspectrum/formats#cassette-audio) — the standard ROM
  tape format, derived from the same two blocks the `.TAP` export uses.
- [BBC Micro / Master](./bbc/formats#cassette-audio) — the cassette filing
  system (CFS) over Kansas City Standard FSK at 1200 baud.
- [Commodore 64 / VIC-20 / PET](./commodore64/formats#cassette-audio) — the
  authentic KERNAL datasette format, shared across the whole lineage; carries
  memory blocks as a multi-file tape.
- [TRS-80](./trs80/formats#cassette-audio) — the Model I 500-baud cassette
  scheme.
- [Acorn Atom](./atom/formats#cassette-audio) — the Acorn cassette filing system
  over Kansas City Standard FSK at 300 baud.
