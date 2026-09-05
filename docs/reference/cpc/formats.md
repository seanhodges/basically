---
title: Amstrad CPC file formats
---

# Amstrad CPC file formats

The Amstrad CPC exports two native binaries — the AMSDOS-headered **`.bas`**
tokenized program and the **`.cdt`** tape image — plus a cassette **`.wav`**. All
three round-trip back to editable source on import, and the IDE also imports a
plain-text `.bas` listing. They all carry the BASIC program only; fixed-address
[memory blocks](../file-formats#machine-code-data-blocks) travel with the
document through the [project bundle](../file-formats#project-bundle-zip) and
share links instead. The Transfer dialog names the blocks an export would leave behind before it writes the file.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [Locomotive BASIC
reference](../cpc) and its [escape codes](./escapes).

## Tokenized program

The image the CPC keeps in RAM from **&0170** and that both containers carry. For
each line: a little-endian **length** word (the bytes to the next line), the
little-endian **line number**, the tokenized statement bytes, then a `0x00`
terminator; the program ends with a **zero length word**. Unlike a keyword-only
table this stores numeric constants in **binary** — small integers, bytes, 16-bit
integers, binary/hex literals, line-number references and 5-byte floats each have
their own inline encoding — so the IDE's detokenizer reformats them losslessly
(hex back to `&…`, floats to Locomotive's display form).

## Amstrad CPC `.bas` (AMSDOS)

The on-disc form: a **128-byte AMSDOS header** followed by the tokenized program.
The header records the filename, the file type, the load address and the length,
and is protected by a 16-bit checksum of its first 66 bytes. Export writes the
header and the program; import tells the three shapes apart automatically — a
headered `.bas`, a raw tokenized program, or a plain-text listing — and loads
whichever it finds, detokenizing the first two back to source with any
import-fidelity notes.

## Amstrad CPC `.cdt` tape

A **TZX-derived** tape image (the CPC community's standard tape container),
carrying the genuine firmware cassette block scheme rather than a raw sample
dump: a header record then data records, the program split into 2K blocks of
256-byte segments each protected by a CRC-16/CCITT. Export writes the program as
one such tape file; import replays the blocks back into the tokenized image and
detokenizes it to source. On the real machine such a tape loads with `RUN"` (or
`LOAD ""`).

## Program data files

A running program's own data files do not go to tape at all. `OPENOUT` with
`PRINT #9`, and `OPENIN` with `INPUT #9` and `EOF`, are served by the IDE: what
the program writes is kept as a named file you can view and download alongside
the program, and the same program reads it straight back. Stream 9 is the file
stream — streams 0 to 7 are screen windows and 8 is the printer.

The file holds exactly the bytes the program wrote, so a `PRINT #9` record ends
with the carriage return and line feed Locomotive BASIC lays down. Each run
starts with an empty set of files.

`LOAD`, `RUN"` and `CHAIN` open a file the same way `OPENIN` does, so they are
served from the same place: a program can write a listing and then chain to it.
A name that has not been saved is left to the cassette, as are `SAVE` and `CAT`
— which is what the `.cdt` and audio sections below cover.

## Cassette audio

The CPC exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono at 44.1 kHz.

The encoding is the CPC firmware cassette scheme: the same header/data records
and CRC-16/CCITT'd 256-byte segments as the `.cdt`, laid down physically as a
pilot tone, a sync bit and the data bits sent **MSB-first at 2000 baud**. A
**robust** mode halves the rate to 1000 baud (longer, more resilient pulses) for
temperamental hardware; the decoder self-scales, reading either speed and using
the segment CRCs to reject noise and flag any corruption on import. To capture a
program from a real CPC, `SAVE "NAME"` and record the tape tone; to send one,
play the exported `.wav` while the CPC reads the tape.
