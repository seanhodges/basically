---
title: Sinclair BASIC file formats
---

# Sinclair BASIC file formats

The machines that run [Sinclair BASIC](../sinclair) carry a program in two quite
different containers: the ZX81's `.P` memory image and the Spectrums' `.TAP`
block file. Each has a section of its own below.

## The ZX81

The ZX81's native binary is the **`.P`** file, which doubles as the in-memory
image the IDE's emulator injects and as the import format that round-trips back
to editable source. The machine also exports and imports a cassette **`.wav`**
(see [Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [ZX81 BASIC reference](../sinclair) and its
[escape codes](./escapes).

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

**Hidden machine-code lines.** Many real `.P` files stash Z80 machine code in
the leading BASIC lines (the code-in-REM trick): a line numbered 0, duplicated
line numbers, or REM bodies containing arbitrary bytes - including embedded
`0x76` - that no BASIC listing can show. Import captures each such line as a
one-line `#BIN <base64>` directive whose payload is the verbatim line record;
the editor shows it as a collapsed "binary line" chip rather than invalid
code. Large well-formed REM lines that are mostly non-printable bytes are
captured the same way instead of appearing as walls of `\{NN}` escapes. On
run and on every export the payload is spliced back at exactly its position
in the program area, so the whole program round-trips byte-for-byte. Delete
the chip's line to drop the code; the payload itself is not editable.

### Cassette audio

The ZX81 exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the leader for temperamental hardware.

The tape scheme is the one described under [Delivering the
image](../serial-protocol#delivering-the-image) in the serial bridge protocol:
bytes MSB-first, `0` = 4 pulses, `1` = 9 pulses, ~1300µs inter-bit gap, 2s
leader (4s robust). The ZX81 prefixes a program-name header (last char +0x80),
so decoding recovers the program name as well as the source text. Every decoder
estimates its bit timing from the recovered signal rather than assuming absolute
durations, so decoding is immune to playback / clock-speed drift, resampling and
sample-rate mismatch.

## The Spectrums

The ZX Spectrum (48K & 128K) native binary is the **`.TAP`** file, which doubles
as the in-memory image the IDE's emulator injects and as the import format that
round-trips back to editable source. A document on either machine can carry
[memory blocks](../file-formats#machine-code-data-blocks) inside the `.TAP` in
**both directions**. The machine also exports and imports a cassette **`.wav`** (see
[Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [ZX Spectrum BASIC
reference](../sinclair) and its [escape codes](./escapes).

### ZX Spectrum `.TAP`

A `.TAP` is a sequence of blocks, each `u16 LE length` then `length` bytes: a
flag byte (0x00 header / 0xFF data), the payload, and a parity byte (the XOR of
the flag and payload). A saved BASIC program is two blocks - a 17-byte header
(type 0x00, 10-char name, data length, auto-run line in param1, program length
in param2), then the program area immediately followed by the variables area (a
lone 0x80 end-marker when there are no variables). param1 ≥ 0x8000 means "load
only"; the IDE exports with auto-run disabled and drives `RUN` itself. The
Spectrum 128's `.TAP` is byte-for-byte identical to the 48K's - only the
tokenizer differs (so `PLAY`/`SPECTRUM` keywords export correctly).

A document with [memory
blocks](../file-formats#machine-code-data-blocks) exports as a **multi-file
tape** on both the 48K and the 128 - the same tape, since the format is the
same: each block becomes a CODE file (header type 3, param1 = load address),
in address order. With the Transfer dialog's **auto-loader** on (the default
when blocks exist), the tape leads with a generated auto-running loader
(`CLEAR` below the lowest block, one `LOAD "" CODE` per block, then `LOAD ""`)
and the main program sits last, auto-starting - so `LOAD ""` on real hardware
runs the complete program. With it off, the load-only main program comes first
and the CODE files follow. Either layout re-imports here with the program and
every block intact; the cassette `.wav` export carries the same tape.

On import, a tape holding CODE files (each with a load address) imports every
CODE file as a block. A tiny `LOAD "" CODE … : RANDOMIZE USR n` loader chaining
into a longer program is recognised: the loader is skipped (with a note) and
the real program imported.

### Cassette audio

The ZX Spectrum exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the pilot for temperamental hardware. A
document's memory blocks travel through the cassette `.wav` the same way they
travel through the `.TAP`, on both machines.

The encoding is the standard ROM tape format, derived from the same two tape
blocks the `.TAP` export uses. Each block is a pilot tone (2168 T-state pulses;
8063 for the header block, 3223 for data), a 667 T + 735 T sync pair, then data
bytes MSB-first where bit `0` = two 855 T pulses and bit `1` = two 1710 T pulses
(1 T-state = 1/3.5MHz). The decoder estimates the pilot pulse length from the
recording and classifies every pulse relative to it, then re-frames the blocks
into a `.TAP` image. The Spectrum 128 reuses this encoder byte-for-byte, driven
from the 128 tokenizer.
