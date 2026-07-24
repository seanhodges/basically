---
title: Commodore 64 / VIC-20 / PET file formats
---

# Commodore 64 / VIC-20 / PET file formats

The Commodore machines (C64, VIC-20, PET) share two native binaries: the
**`.prg`** load-address-prefixed program and the block-carrying **`.d64`** disk
image. Both double as export files and import formats that round-trip back to
editable source, and the `.d64` carries [memory
blocks](../file-formats#machine-code-data-blocks) in **both directions**. All
three machines also export and import a cassette **`.wav`** (see [Cassette
audio](#cassette-audio) below). Only the load address in the first two bytes
differs between them: `$0801` C64, `$1001` unexpanded VIC-20, `$0401` PET.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [Commodore BASIC V2
reference](../commodore64), the [Commodore BASIC 4.0 reference](../pet), and
the [escape codes](./escapes).

## Commodore 64 / VIC-20 / PET `.prg`

The 2-byte little-endian load address (`$01 $08` = $0801) followed by the
tokenized program as it sits in memory from $0801: for each line a 2-byte link
to the next line (an absolute address), the 2-byte line number, the tokenized
body and a `0x00` terminator, ending with a `0x0000` null link. This is the same
image the emulator injects and the import/export file.

The VIC-20 and PET use the identical `.prg` format — the language is the same
Commodore BASIC V2 (the PET adds the BASIC 4.0 disk tokens `$CC–$DA`) — and only
the load address in the first two bytes differs: the unexpanded VIC-20 loads at
$1001 (`$01 $10`), the PET at $0401 (`$01 $04`).

On import, a `.prg` whose load address is not the BASIC start imports as a single
block at that address; a normal program with extra bytes past the end of the
tokenized program imports the program plus those trailing bytes as a block.

## Commodore 64 / VIC-20 / PET `.d64`

The C64, VIC-20 and PET all **import and export** `.d64` disk images — a
byte-exact image of a 1541 5.25" floppy, the multi-file container most Commodore
disk archives use (not to be confused with raw `.tap` pulse recordings, which
are recognised and refused with a clear message). A `.d64` mirrors the real disk
geometry: 35 tracks of 256-byte sectors (21 on the outer tracks down to 17 on
the inner ones, 683 sectors = 174848 bytes), with the block-availability map and
the directory on track 18 and each file stored as a chain of sectors linked by
their first two bytes. A PRG file's data begins with its 2-byte load address.
The disk format is identical across the three machines; only the BASIC program's
load address differs ($0801 C64, $1001 unexpanded VIC-20, $0401 PET).

A multi-file image imports the way a multi-part Spectrum `.TAP` does: the
largest BASIC program opens for editing, other BASIC programs are preserved
with the document, and files loading anywhere other than the machine's BASIC
start import as [memory blocks](../file-formats#machine-code-data-blocks) at
their own load address.

A document with [memory blocks](../file-formats#machine-code-data-blocks)
**exports** as a `.d64` too, the same way — the direct counterpart to the
Spectrum `.TAP` export: the BASIC program is written as the machine's
BASIC-start file and each memory block becomes a further file at its own load
address. With the Transfer dialog's **auto-loader** on, a generated auto-running
loader program leads the disk (it `LOAD`s each block from device 8, then chains
into the main program), and the main program — being the largest BASIC-start
file — is still what re-import opens for editing while the loader rides along as
a preserved file. The exported image re-imports here with the program and every
block intact, and the cassette `.wav` export carries the same files as a
multi-file tape (the `.prg` export still holds the BASIC program alone).

## Cassette audio

All three Commodore machines expose a `.wav` export (and "play through
speakers") **and** a cassette-audio import - listening on the mic / line-in, or
decoding a `.wav` recording, back into editable source. The encoder emits mono
44.1kHz and offers a "robust" mode that lengthens the pilot for temperamental
hardware.

The encoding is the authentic KERNAL datasette format, shared across the whole
Commodore lineage. Information is in the _spacing_ between edges; three pulse
lengths are used - short (S), medium (M), long (L), each one full square-wave
cycle: bit `0` = S,M; bit `1` = M,S; new-data marker = L,M; end-of-data = L,S.
A byte is a new-data marker then 8 data bits LSB-first then an odd-parity bit.
Each block is a long pilot of short pulses, the bytes, then an end-of-data
marker - and the KERNAL writes every block **twice** (first copy prefixed with
the countdown $89..$81, second with $09..$01, each carrying an XOR checksum
byte). A program is two blocks: a 192-byte header (file type, start/end address,
filename) and the tokenized program bytes. The single shared encoder/decoder is
parameterized by the machine's load address ($0801 C64, $1001 VIC-20, $0401 PET)
and the machine's detokenizer (so the PET's BASIC 4.0 disk tokens list correctly
on decode); each of the three exports and imports through it. A document with
[memory blocks](../file-formats#machine-code-data-blocks) exports as a
**multi-file tape** — the program followed by one file per block, optionally
behind a generated auto-loader — and re-imports with the blocks recovered,
exactly as the `.d64` does; all three machines share this too.
