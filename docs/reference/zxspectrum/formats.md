---
title: ZX Spectrum file formats
---

# ZX Spectrum file formats

The ZX Spectrum (48K & 128K) native binary is the **`.TAP`** file, which doubles
as the in-memory image the IDE's emulator injects and as the import format that
round-trips back to editable source. A document on either machine can carry
[memory blocks](../file-formats#machine-code-data-blocks) inside the `.TAP` in
**both directions**. The machine also exports and imports a cassette **`.wav`** (see
[Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [ZX Spectrum BASIC
reference](../zxspectrum) and its [escape codes](./escapes).

## ZX Spectrum `.TAP`

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

## Cassette audio

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
