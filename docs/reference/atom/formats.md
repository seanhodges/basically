---
title: Acorn Atom file formats
---

# Acorn Atom file formats

The Acorn Atom exports two native binaries: the **`.atm`** interchange binary and
the block-carrying **`.dsk`** disk image. Both double as export files and import
formats that round-trip back to editable source, and the `.dsk` carries [memory
blocks](../file-formats#machine-code-data-blocks) in **both directions**. The
machine also exports and imports a cassette **`.wav`** (see [Cassette
audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [Atom BASIC reference](../atom)
and its [escape codes](./escapes).

## Acorn Atom `.atm`

The de-facto interchange format used by Atom emulators (Atomulator, AtoMMC): a
22-byte header followed by the raw memory image.

```
 0..15  filename, ASCII, NUL-padded to 16 bytes
16..17  load address  (little-endian)
18..19  exec address  (little-endian)
20..21  data length   (little-endian)
22..    data bytes
```

For a BASIC program the data is exactly the `#2900` program image the tokeniser
produces (line records ending in `0D FF`), with `load = exec = #2900`. Import
accepts either an `.atm` or a bare image (a bare image always begins with the
`0D` line marker). An `.atm` that loads anywhere other than `#2900` is a
machine-code or data file: it imports as a [memory
block](../file-formats#machine-code-data-blocks), its exec address is kept with the block,
and Run starts it there with `LINK` — the way `*RUN` would on real hardware.

## Acorn Atom `.dsk`

The `.atm` carries a single file, so a document with
[memory blocks](../file-formats#machine-code-data-blocks) exports instead as a **`.dsk` disk
image** that carries the BASIC program _and_ its blocks together. The `.dsk` is
an Acorn DFS-family single-sided disc: a two-sector catalogue lists each file
with its own **load** and **exec** address, exactly what tells a `#2900` BASIC
program apart from machine code at some other address. The program is written
with `load = exec = #2900` and each block at its own address (its exec kept as
the block's entry). Import opens the largest `#2900` program for editing,
preserves any other BASIC programs with the document, and brings the remaining
files back as blocks. Exporting to `.atm` (or cassette `.wav`) instead warns
first that the blocks would be dropped.

## Cassette audio

The Acorn Atom exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the leader for temperamental hardware. The
cassette `.wav` carries the BASIC program only.

The encoding is the Acorn cassette filing system over Kansas City Standard FSK,
but at **300 baud**: `0` = four 1200 Hz cycles, `1` = eight 2400 Hz cycles, each
byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`) with a 2400 Hz
carrier leading in and between blocks. The program is split into ≤256-byte
blocks, each four `*` (0x2A) sync bytes then a header (filename + `0x0D`, flag,
block number, data length−1, exec address, load address - the addresses
big-endian), the data, and a single checksum byte (a plain sum mod 256 over the
header and data). The flag's bit 7 is set on every block except the last. The
decoder classifies half-cycles relative to the carrier and uses the checksum to
find block boundaries and reject noise.
