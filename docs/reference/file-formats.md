# File formats

Every dialect reads and writes the same plain-text editor format (`.txt`) and,
in addition, one **native binary** that real hardware and emulators load
directly (`.P`, `.O`, `.TAP`, `.bbc`, `.prg`, `.cas`, `.atm`) plus a **cassette
`.wav`**. The native binary doubles as the in-memory image the IDE's own
emulator injects, and (for dialects that support importing) as an import format
that round-trips back to editable source.

## Editor source format (.txt)

Plain UTF-8 text, one BASIC line per text line: a line number followed by
exactly one statement. Keywords are written as words (`PRINT`, `GOTO`,
`INKEY$`, `**` for power). Lowercase input is folded to uppercase. The legal
line-number range and statement rules are dialect-specific (see each dialect's
language reference page).

Save writes a `.txt` file by default; load accepts either `.txt` or a legacy
`.bas` file, so programs saved by earlier versions still open unchanged.

## Project bundle (.bproj)

Most documents are pure BASIC and save as `.txt`. A document that also carries
**memory blocks** — fixed-address machine code or data that loads alongside the
program (see [Machine code & data blocks](#machine-code-data-blocks)) — or
extra tape files preserved off a multi-part import saves
instead as a `.bproj` bundle: one human-readable JSON file pairing the BASIC
source with its blocks and preserved files. Each block records its name, load
address, kind (code or data), raw bytes (base64-encoded) and, when the import
recovered one, its entry address; the file notes the machine it was
authored for. Open loads everything together, warning if the active
machine differs; it accepts `.bproj` alongside `.txt`/`.bas`, and also
recognises a project-shaped `.txt`. A document with no blocks or preserved
files never becomes a `.bproj` — the plain-text format is unchanged.

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

| Dialect            | Export | Import         | What it is                                  |
| ------------------ | ------ | -------------- | ------------------------------------------- |
| ZX81               | `.P`   | `.P`           | RAM dump 0x4009 → E_LINE-1                  |
| ZX80               | `.O`   | `.O`           | RAM dump 0x4000 → E_LINE-1                  |
| ZX Spectrum / 128  | `.TAP` | `.TAP`         | header + data tape blocks                   |
| BBC Micro / Master | `.bbc` | `.bbc`         | tokenized program from PAGE                 |
| Commodore 64       | `.prg` | `.prg`, `.t64` | load address + tokenized program from $0801 |
| Commodore VIC-20   | `.prg` | `.prg`         | load address + tokenized program from $1001 |
| Commodore PET      | `.prg` | `.prg`         | load address + tokenized program from $0401 |
| TRS-80             | `.cas` | `.cas`         | Model I CSAVE cassette block                |
| Acorn Atom         | `.atm` | `.atm`         | 22-byte header + `#2900` program image      |

All of these are built by the IDE when you export; the ones that can also be
re-imported are marked in the Import column above. The
[serial bridge](./serial-protocol) sends whichever of these images belongs to
the active dialect.

### ZX81 `.P`

A `.P` file is the ZX81 memory dump from 0x4009 (VERSN) up to but not including
the address in E_LINE - identical to what the ROM's SAVE writes:

```
0x4009  system variables (0x74 bytes)
0x407D  tokenized program
        display file (this IDE writes a collapsed one: 25 x 0x76)
        variables area (terminated by 0x80)
```

The IDE sets `NXTLIN` to the first program line so loaded programs auto-run,
and `CDFLAG` bit 6 for SLOW mode. Exported `.P`
files are built load-only (NXTLIN left at the display file) so they don't
silently auto-run on real hardware - the user types `RUN`.

Import reads `NXTLIN` back: a `.P` saved from inside a running program (the
SAVE-inside-the-program trick) records the line execution resumes from, and
Run starts from that line rather than the first. Only the program text
survives import, so if such a `.P` was saved with live variables the import
notes that the resumed start runs with fresh state.

**Tokenized program area** (ZX81): per line `u16 BE line number`, `u16 LE length`
(body + terminator), tokenized body, `0x76` (NEWLINE). Numeric literals appear
as their printable characters followed by `0x7E` and the 5-byte ZX81 float
(exponent+0x80, then a 4-byte mantissa whose top bit is replaced by the sign).

### ZX80 `.O`

A straight RAM dump from 0x4000 (the start of the 40-byte system-variable block)
up to the byte before E_LINE - exactly what the ROM's SAVE writes and LOAD reads
back. Layout: `system variables | tokenized program | 0x80 variables-end
marker`. The edit line and display file are not part of the image; the ROM
rebuilds them on load. The system-variable values were captured from the real
ROM on an empty machine and have their pointers recomputed for the program
length. ZX80 has no named files.

### ZX Spectrum / Spectrum 128 `.TAP`

A `.TAP` is a sequence of blocks, each `u16 LE length` then `length` bytes: a
flag byte (0x00 header / 0xFF data), the payload, and a parity byte (the XOR of
the flag and payload). A saved BASIC program is two blocks - a 17-byte header
(type 0x00, 10-char name, data length, auto-run line in param1, program length
in param2), then the program area immediately followed by the variables area (a
lone 0x80 end-marker when there are no variables). param1 ≥ 0x8000 means "load
only"; the IDE exports with auto-run disabled and drives `RUN` itself. The
Spectrum 128's `.TAP` is byte-for-byte identical to the 48K's - only the
tokenizer differs (so `PLAY`/`SPECTRUM` keywords export correctly).

### BBC Micro / Master `.bbc`

The exact byte layout BBC BASIC keeps from PAGE and that SAVE writes to disc, so
it doubles as the export file and the payload the emulator pokes in at PAGE. For
each line: `0x0D`, the line number big-endian, a length byte (= body length + 4),
then the tokenized body; the program ends with `0x0D 0xFF`. The output is
byte-for-byte what the genuine ROM tokeniser produces (regression-tested). The
BBC Master uses the same format.

### Commodore 64 / VIC-20 / PET `.prg`

The 2-byte little-endian load address (`$01 $08` = $0801) followed by the
tokenized program as it sits in memory from $0801: for each line a 2-byte link
to the next line (an absolute address), the 2-byte line number, the tokenized
body and a `0x00` terminator, ending with a `0x0000` null link. This is the same
image the emulator injects and the import/export file.

The VIC-20 and PET use the identical `.prg` format — the language is the same
Commodore BASIC V2 (the PET adds the BASIC 4.0 disk tokens `$CC–$DA`) — and only
the load address in the first two bytes differs: the unexpanded VIC-20 loads at
$1001 (`$01 $10`), the PET at $0401 (`$01 $04`).

### Commodore 64 `.t64`

The C64 also **imports** `.t64` tape images — the multi-file directory
container most Commodore tape archives use (not to be confused with raw
`.tap` pulse recordings, which are recognised and refused with a clear
message). A `.t64` is a 64-byte header, a directory of 32-byte entries (each
with a start/end address, a data offset and a filename) and the file
payloads. The importer is lenient with the format's well-known defects: a
zero used-entries count and the broken end-address field some conversion
tools wrote are both worked around, with a note.

A multi-file image imports the way a multi-part Spectrum `.TAP` does: the
largest BASIC entry opens for editing, other BASIC entries are preserved with
the document, and entries loading anywhere other than $0801 import as
[memory blocks](#machine-code-data-blocks) at their own load address.

### TRS-80 `.cas`

The Model I Level II BASIC cassette (CSAVE) block at the byte level: a leader of
`0x00` sync bytes, the `0xA5` sync byte that ends the leader, the three-byte
`0xD3 0xD3 0xD3` BASIC-file marker, a one-character filename, then the tokenized
program exactly as it sits from 0x42E8 (which already ends with its own `0x0000`
link, doubling as the end marker). The `.cas` is both the export file and what an
emulator's virtual cassette deck reads back.

A real tape often concatenates **several** files — a small BASIC loader
followed by the actual game is the classic layout — and import scans them
all: the largest BASIC program opens for editing, other BASIC programs are
preserved with the document, machine code trailing a program on the tape is
kept as a [memory block](#machine-code-data-blocks) at the address CLOAD
would have deposited it, and SYSTEM files import as blocks (below). A
machine-language **SYSTEM** tape uses the same leader and sync followed by a
`0x55` header, a six-character name, then address records (`0x3C` marker,
length, load address, data, checksum) terminated by a `0x78` entry-point
record; each record imports as a block and the entry address is kept with the
block that contains it.

### Acorn Atom `.atm`

The de-facto interchange format used by Atom emulators (Atomulator, AtoMMC): a
22-byte header followed by the raw memory image.

```
 0..15  filename, ASCII, NUL-padded to 16 bytes
16..17  load address  (little-endian)
18..19  exec address  (little-endian)
20..21  data length   (little-endian)
22..    data bytes
```

For a BASIC program the data is exactly the `#2900` program image the tokenizer
produces (line records ending in `0D FF`), with `load = exec = #2900`. Import
accepts either an `.atm` or a bare image (a bare image always begins with the
`0D` line marker). An `.atm` that loads anywhere other than `#2900` is a
machine-code or data file: it imports as a [memory
block](#machine-code-data-blocks), its exec address is kept with the block,
and Run starts it there with `LINK` — the way `*RUN` would on real hardware.

## Machine code & data blocks

Some programs load machine code or data at a fixed address alongside the BASIC
program. The IDE keeps these as named **memory blocks**; on Run they are written
straight into RAM before the program starts, and they travel with the document
through the [project bundle](#project-bundle-bproj) and through
[share links](../guide/publishing). Several native formats carry blocks on
**import**:

- **ZX Spectrum `.TAP`** — a tape holding CODE files (each with a load address)
  imports every CODE file as a block. A tiny `LOAD "" CODE … : RANDOMIZE USR n`
  loader chaining into a longer program is recognised: the loader is skipped
  (with a note) and the real program imported.
- **Commodore `.prg` / `.t64`** — a `.prg` whose load address is not the BASIC
  start ($0801 C64, $1001 VIC-20, $0401 PET) imports as a single block at that
  address; a normal program with extra bytes past the end of the tokenized
  program imports the program plus those trailing bytes as a block. A `.t64`
  tape image (C64) imports every non-BASIC entry as a block.
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

### Sidecar block files (.bin)

The ZX81/ZX80 `.P`/`.O` and BBC `.bbc` formats carry only the BASIC program, so
a block for those machines arrives as a **sidecar file**: drag a
`<name>-<addr>.bin` onto the editor and its bytes are added to the current
document as a block at the address in its file name. The address is hex
(`sprite-0x8000.bin`, also `$` or `&`) or plain decimal (`sprite-32768.bin`),
and the name part becomes the block name. Unlike importing a program file, a
sidecar augments the open document rather than replacing it; it works on any
machine that supports memory blocks. Blocks also travel with a document through
a project bundle or a share link.

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
Each machine uses its own tape encoding:

- **ZX81 / ZX80** - see [Delivering the image](./serial-protocol#delivering-the-image)
  in the serial bridge protocol: bytes MSB-first, `0` = 4 pulses, `1` = 9 pulses,
  ~1300µs inter-bit gap, 2s leader (4s robust). The ZX81 prefixes a program-name
  header (last char +0x80); the ZX80 has no named files and writes the raw `.O`
  image.
- **ZX Spectrum / Spectrum 128** - the standard ROM tape format, derived from the
  same two tape blocks the `.TAP` export uses. Each block is a pilot tone (2168
  T-state pulses; 8063 for the header block, 3223 for data), a 667 T + 735 T sync
  pair, then data bytes MSB-first where bit `0` = two 855 T pulses and bit `1` =
  two 1710 T pulses (1 T-state = 1/3.5MHz). The decoder estimates the pilot pulse
  length from the recording and classifies every pulse relative to it, then
  re-frames the blocks into a `.TAP` image. The Spectrum 128 reuses this encoder
  byte-for-byte, driven from the 128 tokenizer.
- **BBC Micro / Master** - the cassette filing system (CFS) over Kansas City
  Standard FSK at 1200 baud: `0` = one 1200 Hz cycle, `1` = two 2400 Hz cycles,
  each byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`), with a 2400 Hz
  carrier tone leading in and between blocks. The program is split into ≤256-byte
  CFS blocks, each with a `*` (0x2A) sync byte, a header (filename, load/exec
  addresses, block number/length/flag, spare) protected by a CRC-16/CCITT, the
  data, and a data CRC-16. The last block sets bit 7 of the flag. The decoder
  classifies half-cycles relative to the carrier and uses both CRC-16s to find
  block boundaries and reject noise. The encoding is shared by both BBC dialects.
- **Commodore 64 / VIC-20 / PET** - the authentic KERNAL datasette format, shared
  across the whole Commodore lineage. Information is in the
  _spacing_ between edges; three pulse lengths are used - short (S), medium (M),
  long (L), each one full square-wave cycle: bit `0` = S,M; bit `1` = M,S;
  new-data marker = L,M; end-of-data = L,S. A byte is a new-data marker then 8
  data bits LSB-first then an odd-parity bit. Each block is a long pilot of short
  pulses, the bytes, then an end-of-data marker - and the KERNAL writes every
  block **twice** (first copy prefixed with the countdown $89..$81, second with
  $09..$01, each carrying an XOR checksum byte). A program is two blocks: a
  192-byte header (file type, start/end address, filename) and the tokenized
  program bytes. The single shared encoder/decoder is parameterized by the
  machine's load address ($0801 C64, $1001 VIC-20, $0401 PET) and the machine's
  detokenizer (so the PET's BASIC 4.0 disk tokens list correctly on decode);
  each of the three exports and imports through it.
- **TRS-80** - the Model I 500-baud cassette scheme. Every bit cell opens with a
  _clock_ pulse; a `1` bit additionally fires a _data_ pulse at the middle of the
  cell, a `0` does not - so the spacing between pulses carries the data (a `1` is
  two half-cell gaps, a `0` is one full-cell gap). Bytes are MSB-first. A block is
  a long leader of `0x00` bytes (all clock pulses, letting the reader lock on),
  the `0xA5` sync byte, the `0xD3 0xD3 0xD3` BASIC marker, a one-character
  filename and the tokenized program - i.e. the `.cas` image rendered to audio.
- **Acorn Atom** - the Acorn cassette filing system over Kansas City Standard
  FSK, but at **300 baud**: `0` = four 1200 Hz cycles, `1` = eight 2400 Hz
  cycles, each byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`) with
  a 2400 Hz carrier leading in and between blocks. The program is split into
  ≤256-byte blocks, each four `*` (0x2A) sync bytes then a header (filename +
  `0x0D`, flag, block number, data length−1, exec address, load address - the
  addresses big-endian), the data, and a single checksum byte (a plain sum mod
  256 over the header and data). The flag's bit 7 is set on every block except
  the last. The decoder classifies half-cycles relative to the carrier and uses
  the checksum to find block boundaries and reject noise. The Atom also exports /
  imports a native `.atm` binary (see above).
