# File formats

Every dialect reads and writes the same plain-text editor format (`.bas`) and,
in addition, one **native binary** that real hardware and emulators load
directly (`.P`, `.O`, `.TAP`, `.bbc`, `.prg`, `.cas`, `.atm`) plus a **cassette
`.wav`**. The native binary doubles as the in-memory image the IDE's own
emulator injects, and (for dialects with `binaryImports`) as an import format
that round-trips back to editable source via `dialect.detokenize`.

## Editor source format (.bas)

Plain UTF-8 text, one BASIC line per text line: a line number followed by
exactly one statement. Keywords are written as words (`PRINT`, `GOTO`,
`INKEY$`, `**` for power). Lowercase input is folded to uppercase. The legal
line-number range and statement rules are dialect-specific (see each dialect
folder / `CLAUDE.md`).

Each dialect maps its own character set, so the special-character conventions
below are **ZX81-specific** (zxtext2p-compatible where practical); the Spectrum,
BBC, C64, TRS-80 and Atom have their own block-graphics / PETSCII / teletext
escapes defined in their `charset.ts`.

| Source               | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `▘▝▀▖▌▞▛`            | quarter/half block graphics (codes 0x01–0x07)                    |
| `█▟▙▄▜▐▚▗`           | inverse block graphics (0x80–0x87)                               |
| `▒`                  | grey block (0x08)                                                |
| `\!!` `\!'` `\!.`    | grey full / top / bottom (0x08–0x0A)                             |
| `\|                  | ` `\|'` `\|.`                                                    | inverse grey full / top / bottom (0x88–0x8A) |
| `\' ` `\ '` `\''` …  | quadrant escapes: left+right column, `'`=top `.`=bottom `:`=full |
| `%A` … `%9`          | inverse video character                                          |
| `""` inside a string | the quote-image character (0xC0)                                 |
| `£`                  | pound sign (0x0C)                                                |

`#` and other characters outside the ZX81 set are tokenizer errors.

## Native binary formats

| Dialect            | Export | Import | What it is                                  |
| ------------------ | ------ | ------ | ------------------------------------------- |
| ZX81               | `.P`   | `.P`   | RAM dump 0x4009 → E_LINE-1                  |
| ZX80               | `.O`   | `.O`   | RAM dump 0x4000 → E_LINE-1                  |
| ZX Spectrum / 128  | `.TAP` | `.TAP` | header + data tape blocks                   |
| BBC Micro / Master | `.bbc` | `.bbc` | tokenized program from PAGE                 |
| Commodore 64       | `.prg` | `.prg` | load address + tokenized program from $0801 |
| TRS-80             | `.cas` | `.cas` | Model I CSAVE cassette block                |
| Acorn Atom         | `.atm` | `.atm` | 22-byte header + `#2900` program image      |

All of these are built by the dialect's `buildTargets`; the importable ones are
listed in its `binaryImports`. The serial bridge (`docs/reference/serial-protocol.md`)
sends whichever of these images belongs to the active dialect.

### ZX81 `.P`

A `.P` file is the ZX81 memory dump from 0x4009 (VERSN) up to but not including
the address in E_LINE — identical to what the ROM's SAVE writes:

```
0x4009  system variables (0x74 bytes)
0x407D  tokenized program
        display file (this IDE writes a collapsed one: 25 x 0x76)
        variables area (terminated by 0x80)
```

The IDE sets `NXTLIN` to the first program line so loaded programs auto-run
(toggleable in `buildPFile`), and `CDFLAG` bit 6 for SLOW mode. Exported `.P`
files are built load-only (NXTLIN left at the display file) so they don't
silently auto-run on real hardware — the user types `RUN`.

**Tokenized program area** (ZX81): per line `u16 BE line number`, `u16 LE length`
(body + terminator), tokenized body, `0x76` (NEWLINE). Numeric literals appear
as their printable characters followed by `0x7E` and the 5-byte ZX81 float
(exponent+0x80, then a 4-byte mantissa whose top bit is replaced by the sign).
Code: `src/dialects/zx81/{pfile,tokenizer,zxfloat}.ts`.

### ZX80 `.O`

A straight RAM dump from 0x4000 (the start of the 40-byte system-variable block)
up to the byte before E_LINE — exactly what the ROM's SAVE writes and LOAD reads
back. Layout: `system variables | tokenized program | 0x80 variables-end
marker`. The edit line and display file are not part of the image; the ROM
rebuilds them on load. The system-variable values were captured from the real
ROM on an empty machine and have their pointers recomputed for the program
length. ZX80 has no named files. Code: `src/dialects/zx80/ofile.ts`.

### ZX Spectrum / Spectrum 128 `.TAP`

A `.TAP` is a sequence of blocks, each `u16 LE length` then `length` bytes: a
flag byte (0x00 header / 0xFF data), the payload, and a parity byte (the XOR of
the flag and payload). A saved BASIC program is two blocks — a 17-byte header
(type 0x00, 10-char name, data length, auto-run line in param1, program length
in param2), then the program area immediately followed by the variables area (a
lone 0x80 end-marker when there are no variables). param1 ≥ 0x8000 means "load
only"; the IDE exports with auto-run disabled and drives `RUN` itself. The
Spectrum 128's `.TAP` is byte-for-byte identical to the 48K's — only the
tokenizer differs (so `PLAY`/`SPECTRUM` keywords export correctly). Code:
`src/dialects/zxspectrum/tapfile.ts` (shared by both Spectrum dialects).

### BBC Micro / Master `.bbc`

The exact byte layout BBC BASIC keeps from PAGE and that SAVE writes to disc, so
it doubles as the export file and the payload the emulator pokes in at PAGE. For
each line: `0x0D`, the line number big-endian, a length byte (= body length + 4),
then the tokenized body; the program ends with `0x0D 0xFF`. The output is
byte-for-byte what the genuine ROM tokeniser produces (regression-tested). The
BBC Master uses the same format. Code: `src/dialects/bbcmicro/tokenizer.ts`
(shared by both BBC dialects).

### Commodore 64 `.prg`

The 2-byte little-endian load address (`$01 $08` = $0801) followed by the
tokenized program as it sits in memory from $0801: for each line a 2-byte link
to the next line (an absolute address), the 2-byte line number, the tokenized
body and a `0x00` terminator, ending with a `0x0000` null link. This is the same
image the emulator injects and the import/export file. Code:
`src/dialects/commodore64/{targets,tokenizer}.ts`.

### TRS-80 `.cas`

The Model I Level II BASIC cassette (CSAVE) block at the byte level: a leader of
`0x00` sync bytes, the `0xA5` sync byte that ends the leader, the three-byte
`0xD3 0xD3 0xD3` BASIC-file marker, a one-character filename, then the tokenized
program exactly as it sits from 0x42E8 (which already ends with its own `0x0000`
link, doubling as the end marker). The `.cas` is both the export file and what an
emulator's virtual cassette deck reads back. Code:
`src/dialects/trs80/casfile.ts`.

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
`0D` line marker). Code: `src/dialects/atom/atm.ts`.

## Cassette audio

Dialects whose machines loaded from tape expose a `.wav` export (and "play
through speakers") **and** a cassette-audio import — listening on the mic /
line-in, or decoding a `.wav` recording, back into editable source — via the
optional `audio` field on the `Dialect` interface. All encoders emit mono
44.1kHz and offer a "robust" mode that lengthens the leader/pilot for
temperamental hardware.

The handling is dialect-agnostic: the app's Import / Export dialogs only ever
call `audio.buildSamples` (encode) and `audio.decodeSamples` (decode) on the
selected dialect — they never know which machine is loaded. `decodeSamples` is
the inverse of `buildSamples`, recovering the machine's program name (where the
format carries one) and source text. Every decoder estimates its bit timing
from the recovered signal rather than assuming absolute durations, so decoding
is immune to playback / clock speed drift, resampling and sample-rate mismatch.
Each machine uses its own tape encoding:

- **ZX81 / ZX80** — see `docs/reference/serial-protocol.md` § Delivering a .P image: bytes
  MSB-first, `0` = 4 pulses, `1` = 9 pulses, ~1300µs inter-bit gap, 2s leader
  (4s robust). The ZX81 prefixes a program-name header (last char +0x80); the
  ZX80 has no named files and writes the raw `.O` image. Encoders:
  `src/dialects/{zx81,zx80}/audio/cassetteEncoder.ts`; the shared signal→bytes
  decoder is `src/dialects/sinclairTape.ts`, with the per-machine name / `.O`
  handling in each `audio/cassetteDecoder.ts`.
- **ZX Spectrum / Spectrum 128** — the standard ROM tape format, derived from the
  same two tape blocks the `.TAP` export uses (`tapBlocks()` in
  `zxspectrum/tapfile.ts`). Each block is a pilot tone (2168 T-state pulses; 8063
  for the header block, 3223 for data), a 667 T + 735 T sync pair, then data bytes
  MSB-first where bit `0` = two 855 T pulses and bit `1` = two 1710 T pulses (1
  T-state = 1/3.5MHz). The decoder estimates the pilot pulse length from the
  recording and classifies every pulse relative to it, then re-frames the blocks
  into a `.TAP` image for `parseTap`. The Spectrum 128 reuses this encoder
  byte-for-byte (`src/dialects/zxspectrum128/targets.ts` drives it from the 128
  tokenizer). Code: `src/dialects/zxspectrum/audio/cassette{Encoder,Decoder}.ts`.
- **BBC Micro / Master** — the cassette filing system (CFS) over Kansas City
  Standard FSK at 1200 baud: `0` = one 1200 Hz cycle, `1` = two 2400 Hz cycles,
  each byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`), with a 2400 Hz
  carrier tone leading in and between blocks. The program is split into ≤256-byte
  CFS blocks, each with a `*` (0x2A) sync byte, a header (filename, load/exec
  addresses, block number/length/flag, spare) protected by a CRC-16/CCITT, the
  data, and a data CRC-16. The last block sets bit 7 of the flag. The decoder
  classifies half-cycles relative to the carrier and uses both CRC-16s to find
  block boundaries and reject noise. Code:
  `src/dialects/bbcmicro/audio/cassette{Encoder,Decoder}.ts` (shared by both BBC
  dialects).
- **Commodore 64** — the authentic KERNAL datasette format. Information is in the
  _spacing_ between edges; three pulse lengths are used — short (S), medium (M),
  long (L), each one full square-wave cycle: bit `0` = S,M; bit `1` = M,S;
  new-data marker = L,M; end-of-data = L,S. A byte is a new-data marker then 8
  data bits LSB-first then an odd-parity bit. Each block is a long pilot of short
  pulses, the bytes, then an end-of-data marker — and the KERNAL writes every
  block **twice** (first copy prefixed with the countdown $89..$81, second with
  $09..$01, each carrying an XOR checksum byte). A program is two blocks: a
  192-byte header (file type, start/end address, filename) and the tokenized
  program bytes from $0801. Code:
  `src/dialects/commodore64/audio/cassette{Encoder,Decoder}.ts`.
- **TRS-80** — the Model I 500-baud cassette scheme. Every bit cell opens with a
  _clock_ pulse; a `1` bit additionally fires a _data_ pulse at the middle of the
  cell, a `0` does not — so the spacing between pulses carries the data (a `1` is
  two half-cell gaps, a `0` is one full-cell gap). Bytes are MSB-first. A block is
  a long leader of `0x00` bytes (all clock pulses, letting the reader lock on),
  the `0xA5` sync byte, the `0xD3 0xD3 0xD3` BASIC marker, a one-character
  filename and the tokenized program — i.e. the `.cas` image rendered to audio.
  Code: `src/dialects/trs80/audio/cassette{Encoder,Decoder}.ts`.
- **Acorn Atom** — the Acorn cassette filing system over Kansas City Standard
  FSK, but at **300 baud**: `0` = four 1200 Hz cycles, `1` = eight 2400 Hz
  cycles, each byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`) with
  a 2400 Hz carrier leading in and between blocks. The program is split into
  ≤256-byte blocks, each four `*` (0x2A) sync bytes then a header (filename +
  `0x0D`, flag, block number, data length−1, exec address, load address — the
  addresses big-endian), the data, and a single checksum byte (a plain sum mod
  256 over the header and data). The flag's bit 7 is set on every block except
  the last. The decoder classifies half-cycles relative to the carrier and uses
  the checksum to find block boundaries and reject noise. Code:
  `src/dialects/atom/audio/cassette{Encoder,Decoder}.ts`. The Atom also exports /
  imports a native `.atm` binary (see above); see `src/dialects/atom/atm.ts`.
