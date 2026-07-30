---
title: Amstrad CPC file formats
---

# Amstrad CPC file formats

The Amstrad CPC exports two native binaries — the AMSDOS-headered **`.bas`**
tokenised program and the **`.cdt`** tape image — plus a cassette **`.wav`**. All
three round-trip back to editable source on import, and the IDE also imports a
plain-text `.bas` listing. They all carry the BASIC program only; fixed-address
[memory blocks](../file-formats#machine-code-data-blocks) travel with the
document through the [project bundle](../file-formats#project-bundle-zip) and
share links instead.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [Locomotive BASIC
reference](../cpc) and its [escape codes](./escapes).

## tokenised program

The image the CPC keeps in RAM from **&0170** and that both containers carry. For
each line: a little-endian **length** word (the bytes to the next line), the
little-endian **line number**, the tokenised statement bytes, then a `0x00`
terminator; the program ends with a **zero length word**. Unlike a keyword-only
table this stores numeric constants in **binary** — small integers, bytes, 16-bit
integers, binary/hex literals, line-number references and 5-byte floats each have
their own inline encoding — so the IDE's detokeniserreformats them losslessly
(hex back to `&…`, floats to Locomotive's display form).

## Amstrad CPC `.bas` (AMSDOS)

The on-disc form: a **128-byte AMSDOS header** followed by the tokenised program.
The header records the filename, the file type, the load address and the length,
and is protected by a 16-bit checksum of its first 66 bytes. Export writes the
header and the program; import tells the three shapes apart automatically — a
headered `.bas`, a raw tokenised program, or a plain-text listing — and loads
whichever it finds, detokenizing the first two back to source with any
import-fidelity notes.

## Amstrad CPC `.cdt` tape

A **TZX-derived** tape image (the CPC community's standard tape container),
carrying the genuine firmware cassette block scheme rather than a raw sample
dump: a header record then data records, the program split into 2K blocks of
256-byte segments each protected by a CRC-16/CCITT. Export writes the program as
one such tape file; import replays the blocks back into the tokenised image and
detokenises it to source. On the real machine such a tape loads with `RUN"` (or
`LOAD ""`).

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
