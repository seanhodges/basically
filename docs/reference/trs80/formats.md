---
title: TRS-80 file formats
---

# TRS-80 file formats

The TRS-80 (Model I Level II BASIC) exports two native binaries: the **`.cas`**
cassette block and the block-carrying **`.dsk`** disk image. Both double as
export files and import formats that round-trip back to editable source, and the
`.dsk` carries [memory blocks](../file-formats#machine-code-data-blocks) in
**both directions**. The machine also exports and imports a cassette **`.wav`**
(see [Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [TRS-80 Level II BASIC
reference](../trs80) and its [escape codes](./escapes).

## TRS-80 `.cas`

The Model I Level II BASIC cassette (CSAVE) block at the byte level: a leader of
`0x00` sync bytes, the `0xA5` sync byte that ends the leader, the three-byte
`0xD3 0xD3 0xD3` BASIC-file marker, a one-character filename, then the tokenised
program exactly as it sits from 0x42E8 (which already ends with its own `0x0000`
link, doubling as the end marker). The `.cas` is both the export file and what an
emulator's virtual cassette deck reads back.

A real tape often concatenates **several** files — a small BASIC loader
followed by the actual game is the classic layout — and import scans them
all: the largest BASIC program opens for editing, other BASIC programs are
preserved with the document, machine code trailing a program on the tape is
kept as a [memory block](../file-formats#machine-code-data-blocks) at the address CLOAD
would have deposited it, and SYSTEM files import as blocks (below). A
machine-language **SYSTEM** tape uses the same leader and sync followed by a
`0x55` header, a six-character name, then address records (`0x3C` marker,
length, load address, data, checksum) terminated by a `0x78` entry-point
record; each record imports as a block and the entry address is kept with the
block that contains it.

## TRS-80 `.dsk`

The `.cas` cassette carries the BASIC program only, so a document with
[memory blocks](../file-formats#machine-code-data-blocks) exports instead as a **`.dsk`
disk image** that carries the program _and_ its blocks in one file. The `.dsk`
is a **JV1** disc — the simplest, most widely-read TRS-80 disk format: a flat
run of 256-byte sectors (Model I single density, 35 tracks × 10 sectors) with a
**TRSDOS**-style directory on track 17. The BASIC program is stored as a
`NAME/BAS` file and each memory block as a `NAME/CMD` load module that records
the block's load and entry addresses. Import opens the largest BASIC program for
editing, preserves any other BASIC programs with the document, and brings each
`/CMD` file back as a block at its load address. Exporting to `.cas` (or cassette
`.wav`) instead warns first that the blocks would be dropped.

## Cassette audio

The TRS-80 exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the leader for temperamental hardware. The
cassette `.wav` carries the BASIC program only (the same content as the `.cas`).

The encoding is the Model I 500-baud cassette scheme. Every bit cell opens with
a _clock_ pulse; a `1` bit additionally fires a _data_ pulse at the middle of
the cell, a `0` does not - so the spacing between pulses carries the data (a `1`
is two half-cell gaps, a `0` is one full-cell gap). Bytes are MSB-first. A block
is a long leader of `0x00` bytes (all clock pulses, letting the reader lock on),
the `0xA5` sync byte, the `0xD3 0xD3 0xD3` BASIC marker, a one-character
filename and the tokenised program - i.e. the `.cas` image rendered to audio.
