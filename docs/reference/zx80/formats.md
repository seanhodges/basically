---
title: ZX80 file formats
---

# ZX80 file formats

The ZX80's native binary is the **`.O`** file, which doubles as the in-memory
image the IDE's emulator injects and as the import format that round-trips back
to editable source. The machine also exports and imports a cassette **`.wav`**
(see [Cassette audio](#cassette-audio) below). ZX80 has no named files.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [ZX80 integer BASIC
reference](../zx80) and its [escape codes](./escapes).

## ZX80 `.O`

A straight RAM dump from 0x4000 (the start of the 40-byte system-variable block)
up to the byte before E_LINE - exactly what the ROM's SAVE writes and LOAD reads
back. Layout: `system variables | tokenized program | 0x80 variables-end
marker`. The edit line and display file are not part of the image; the ROM
rebuilds them on load. The system-variable values were captured from the real
ROM on an empty machine and have their pointers recomputed for the program
length.

Hidden machine-code lines (line number 0, duplicate numbers, large
non-printable REM bodies) import as `#BIN <base64>` directives exactly as for
the [ZX81 `.P`](../zx81/formats#zx81-p) format; the only difference is the record
shape - ZX80 records are `u16 BE line number + body + 0x76` with no length
field, so a body can never embed a stray `0x76`.

## Cassette audio

The ZX80 exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import - listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz and offers
a "robust" mode that lengthens the leader for temperamental hardware.

The tape scheme is the one described under [Delivering the
image](../serial-protocol#delivering-the-image) in the serial bridge protocol:
bytes MSB-first, `0` = 4 pulses, `1` = 9 pulses, ~1300µs inter-bit gap, 2s
leader (4s robust). The ZX80 has no named files and writes the raw `.O` image.
The decoder estimates its bit timing from the recovered signal rather than
assuming absolute durations, so decoding is immune to playback / clock-speed
drift, resampling and sample-rate mismatch.
