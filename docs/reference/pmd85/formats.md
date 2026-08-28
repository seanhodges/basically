---
title: PMD 85 file formats
---

# PMD 85 file formats

The PMD 85 had one thing to write to and it was a cassette, so all three
exports are the same tape in different wrappers: **`.ptp`**, the tape image the
community emulators swap; **`.pmd`**, the older one-file-per-tape form; and a
cassette **`.wav`** carrying the same blocks as audio. All three are also import
formats and round-trip back to editable source. No PMD 85 export carries
[memory blocks](../file-formats#machine-code-data-blocks) — BASIC-G's `SAVE`
writes the program area and nothing else — though an import can bring one back
(below).

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [BASIC-G reference](../pmd85), its
[hardware notes](./hardware) and its [escape codes](./escapes).

## PMD 85 `.ptp`

A tape image: every block on the tape behind a little-endian `u16` length, one
after another to the end of the file. Nothing else — no signature, no directory,
no count. A reader walks it without having to understand what is on it, which is
what lets a tape hold several files and lets a block with no header at all
travel intact.

One saved file is two blocks: a **header block**, always 63 bytes, and a **body
block**.

The header block opens with 48 bytes of leader — sixteen `FF`, sixteen `00`,
sixteen `55` — and then describes the file in fifteen:

| Offset | Size | Field                                         |
| ------ | ---- | --------------------------------------------- |
| 48     | 1    | file number, the argument `SAVE`/`LOAD` take  |
| 49     | 1    | type letter; `>` a program, `D` a saved array |
| 50     | 2    | load address, little endian                   |
| 52     | 2    | body length **minus one**, little endian      |
| 54     | 8    | name, space padded                            |
| 62     | 1    | checksum of the fourteen bytes before it      |

The body block is the bytes themselves followed by one checksum byte. Both
checksums are the same thing — the bytes summed modulo 256 — despite the
community documentation calling the field a CRC.

A saved program is **one byte longer than the program**. BASIC-G writes from the
start of the program text through the end-of-program pointer inclusive, and
`LOAD` sets that pointer back from the header's length field, so the field is
exactly the program's own length and the body carries one byte more. Trimming
that byte would leave the interpreter's idea of where variables begin one short
of the end of the program.

Two things follow from the machine's tape commands taking a **number** rather
than a name. A program is exported as **file 1**, so `LOAD 1` is what picks it
up; and the eight-character name field is a label for a human to read in a tape
browser, filled with the document's name here and left blank by the machine
itself.

On import the first `>` file on the tape opens for editing. Anything else —
data a program saved for itself, a second program — is kept with the document
and put on the emulator's tape deck, so a program that reaches its own `LOAD n`
finds it. A block with no header is reported and not opened: what is in one is
the business of the program that wrote it. A block whose checksum disagrees is
reported and kept anyway, because a tape that read back imperfectly is still
worth more than an error message.

A running program's own tape writes are kept the same way, so `DSAVE 2;A(0)`
followed later by `DLOAD 2;B(0)` finds the array — within the run and in the
next one. Each saved file is listed under its number, because the number is the
only part of the header the interpreter matches on: the name field is blank
after a `SAVE` and holds whatever was next to the array after a `DSAVE`.

Bytes found after the end-of-program marker are what would have been sitting
straight above the program in memory, so they come back as a [memory
block](../file-formats#machine-code-data-blocks) at the address they followed
the program at.

## PMD 85 `.pmd`

The same two blocks with nothing between them: 63 bytes of header, then the
body and its checksum, and that is the whole file. Older and simpler than
`.ptp`, one file per tape, and still what a lot of archived software is filed
as.

The two cannot be confused. A `.pmd` opens on the header leader's `FF FF`,
which as a `.ptp` length would be a 64K block that no such file is long enough
to hold.

One file is the limit rather than a convention. Without the length in front of
each block, a reader can only find the next header by recognising its leader,
and a body is free to contain those same bytes — so a multi-file `.pmd` is
ambiguous by construction, and `.ptp` is what a tape of several files is
written as.

## Cassette audio

The PMD 85 exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz. The
cassette `.wav` carries exactly the blocks of the `.ptp` above.

The encoding is **not** the Kansas City Standard several other machines here
use, and it is not a two-tone modem at all. There is only one tone: a 1200 Hz
square wave whose _phase_ is the data. Every bit is one whole cycle of it, and
which way round that cycle goes is the bit — high then low is a `1`, low then
high is a `0`. Put the other way, and the way the hardware builds it, the
recorded level is the clock exclusive-ORed with the bit. A receiver that has to
find its own timing in the signal gets a transition in the middle of every bit
to find it with.

Above that it is ordinary asynchronous serial at 1200 baud, because a serial
chip is what drives it: each byte is a `0` start bit, eight data bits
least-significant first, and **two** `1` stop bits — eleven bit periods a byte.

The leaders are carrier rather than silence, a run of `1` bits being a plain
1200 Hz square wave. A header block is preceded by 2.8 seconds of it and a body
block by half a second, a fifth of a second follows the last byte of a file, and
where a recorder would have been stopped between files there is a second and a
half of real silence. "Robust" mode lengthens the leaders and the tail for
temperamental hardware.

Phase encoding has no idle level to give its polarity away: a recorder, a sound
card or a cable that inverts the signal inverts every bit rather than flipping
something nobody would notice. The decoder therefore reads the recording both
ways up, and both ways of pairing half-cycles into bits, and keeps whichever
frames into real blocks — which is also what lets it read a recording made at a
different sample rate or played back by a recorder running off speed.

On a real PMD 85, type `SAVE 1` and press EOL with the recorder running to save,
and `LOAD 1` and press EOL, then start playback, to load; the machine returns to
`OK` when the program is in, and `RUN` starts it. There is no name to give
either command — `SAVE "GAME"` answers with a type error. Import and export here
work on the file and the audio directly, without going through the emulator;
what the emulator's own tape deck plays is the extra files an imported tape
carried, together with whatever the running program has saved for itself, so a
`LOAD n` or `DLOAD n` finds either.
