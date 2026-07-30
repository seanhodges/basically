---
title: BBC Micro / Master file formats
---

# BBC Micro / Master file formats

BBC BASIC (Micro & Master) exports two native binaries: the headerless **`.bbc`**
tokenised program, and the block-carrying **`.ssd`** disc image. Both double as
export files and import formats that round-trip back to editable source, and the
`.ssd` carries [memory blocks](../file-formats#machine-code-data-blocks) in
**both directions**. The machine also exports and imports a cassette **`.wav`**
(see [Cassette audio](#cassette-audio) below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [BBC BASIC reference](../bbc) and its
[escape codes](./escapes).

## BBC Micro / Master `.bbc`

The exact byte layout BBC BASIC keeps from PAGE and that SAVE writes to disc, so
it doubles as the export file and the payload the emulator pokes in at PAGE. For
each line: `0x0D`, the line number big-endian, a length byte (= body length + 4),
then the tokenised body; the program ends with `0x0D 0xFF`. The output is
byte-for-byte what the genuine ROM tokeniser produces (regression-tested). The
BBC Master uses the same format.

Machine code can ride inside the `.bbc` itself as **inline assembly** — a
`[ … ]` assembler block in the BASIC listing (`DIM` a buffer, `[OPT…]` assemble
into it at run time). That is ordinary BASIC source, so it tokenises to the same
ROM bytes and round-trips through the `.bbc` with no separate file. Machine code
that lives at its own fixed address instead — a separate code/data block — is
carried by the `.ssd` disc below.

## BBC Micro / Master `.ssd`

An Acorn DFS single-sided disc image (80 tracks × 10 × 256 = 200K), the standard
BBC multi-file container. Unlike the headerless `.bbc`, a `.ssd` holds several
files, each with its own **load and exec address** in the two-sector catalogue —
the attributes MOS uses to tell a BASIC program (`CHAIN`, load = exec = PAGE)
from machine code (`*RUN`, load/exec = the code's address). A document that has
[memory blocks](../file-formats#machine-code-data-blocks) exports as a `.ssd`: the BASIC program
is the file at PAGE and each block is a further file at its own load address (its
exec address remembered for machine code). With the Transfer dialog's
**auto-loader** on (the default when blocks exist), a generated `!BOOT`
(`*OPT 4,3`) leads the disc — it `*LOAD`s each block and `CHAIN`s the program (or
`*RUN`s the code when there is no BASIC) — so the disc runs by itself on real
hardware (SHIFT+BREAK). Import re-opens the BASIC program for editing and brings
every other file back as a block. Running a document with blocks in this IDE
mounts the same `.ssd` and boots it, so the emulator distinguishes BASIC from
machine code exactly as MOS does. A pure-BASIC document keeps exporting the plain
`.bbc`.

Many real game discs, though, load files at addresses the block model can't
hold — below PAGE, overlapping each other, or overlapping the program area,
because the disc's own loader stages them in at different times rather than
keeping them all resident. Importing such a disc keeps the **whole image** and
boots it verbatim (exactly as SHIFT+BREAK does on real hardware) so its loader
runs and every file lands at its true address; the recovered loader listing is
shown in the editor for reference. Editing that listing (or adding a block)
turns the document back into a normal, editable program that runs through the
tokeniser.

## Cassette audio

The BBC exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the leader for temperamental hardware. The
cassette `.wav` carries the BASIC program only.

The encoding is the cassette filing system (CFS) over Kansas City Standard FSK
at 1200 baud: `0` = one 1200 Hz cycle, `1` = two 2400 Hz cycles, each byte
framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`), with a 2400 Hz carrier
tone leading in and between blocks. The program is split into ≤256-byte CFS
blocks, each with a `*` (0x2A) sync byte, a header (filename, load/exec
addresses, block number/length/flag, spare) protected by a CRC-16/CCITT, the
data, and a data CRC-16. The last block sets bit 7 of the flag. The decoder
classifies half-cycles relative to the carrier and uses both CRC-16s to find
block boundaries and reject noise. The encoding is shared by both BBC dialects.
