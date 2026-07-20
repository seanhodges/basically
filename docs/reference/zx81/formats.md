---
title: ZX81 file formats
---

# ZX81 file formats

The ZX81's native binary is the **`.P`** file, which doubles as the in-memory
image the IDE's emulator injects and as the import format that round-trips back
to editable source. The machine also exports and imports a cassette **`.wav`**
(see [Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.bproj` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [ZX81 BASIC reference](../zx81) and its
[escape codes](./escapes).

## `.P`

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

## Cassette audio

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
