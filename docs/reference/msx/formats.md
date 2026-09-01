---
title: MSX file formats
---

# MSX file formats

The MSX exports two native binaries — the tokenized **`.bas`** a disc save
leaves and the **`.cas`** tape image the community emulators read — plus a
cassette **`.wav`** carrying the same tape as audio. All three round-trip back to
editable source on import, and the IDE also reads the plain ASCII listing that
`SAVE"name",A` writes. None of them carries
[memory blocks](../file-formats#machine-code-data-blocks): both `SAVE` and
`CSAVE` write the program area and nothing else, so blocks travel with the
document through the [project bundle](../file-formats#project-bundle-zip) and
share links instead.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the
[file formats overview](../file-formats). See also the
[MSX BASIC reference](../msx), its [hardware notes](./hardware) and its
[escape codes](./escapes).

## Tokenized program

What both containers carry, and what sits in RAM from `0x8001`. For each line: a
little-endian **link word** holding the address of the next line, the
little-endian **line number**, the tokenized statement bytes, then a `0x00`
terminator. The program ends with a **zero link word**, and the interpreter
wants a zero byte at `0x8000` in front of the first line.

Keywords are single bytes from `0x81` to `0xFC`, except for the functions, which
are two — a `0xFF` prefix and a second byte from `0x81` to `0xB0`, so `LEFT$` is
`FF 81`. Two words are stored behind a colon the listing hides: `ELSE` is
`3A A1` and the `'` comment is `3A 8F E6`.

Numeric constants are stored **typed**, which is the part of this format a
reader has to implement rather than skip:

| Prefix        | What follows                                     |
| ------------- | ------------------------------------------------ |
| `0x0B`        | an octal literal, two bytes                      |
| `0x0C`        | a hex literal (`&H…`), two bytes                 |
| `0x0D`        | a line pointer, which only exists after a `RUN`  |
| `0x0E`        | a line number, after `GOTO`, `GOSUB` and friends |
| `0x0F`        | an integer from 11 to 255, one byte              |
| `0x11`–`0x1A` | the constants 0 to 9, in the token itself        |
| `0x1C`        | a two-byte signed integer                        |
| `0x1D`        | a four-byte single-precision float               |
| `0x1F`        | an eight-byte double-precision float             |

The floats hold **decimal digits** rather than a binary mantissa, which is where
MSX BASIC's fourteen-digit double comes from. It is also why **a line's end
cannot be found by scanning for its `0x00`**: a mantissa byte and a line
reference's high byte are both routinely zero, so a reader has to decode each
constant to know where the line stops.

Because a link word is an absolute address, a program is written for one base
and relinked on import.

## MSX `.bas`

The disc form, and the simplest container here: a single **`0xFF` marker byte**
followed by the tokenized program exactly as it sits in memory. A file starting
with anything else is an ASCII listing — what `SAVE"name",A` writes — and the
IDE reads that instead, through the character set rather than the token decoder,
stopping at the `0x1A` end-of-file mark MSX BASIC leaves on the end.

## MSX `.cas`

A tape image: the blocks a real tape carries, with each header tone replaced by
an eight-byte marker, `1F A6 DE BA CC 13 7D 74`. Every marker sits on an
eight-byte boundary and the gap in front of it is zero-filled.

One saved file is two blocks. The first is a **header block** of ten copies of a
marker byte saying what kind of file follows, then six bytes of name, padded with
spaces:

| Marker | Written by          | What follows                           |
| ------ | ------------------- | -------------------------------------- |
| `0xD3` | `CSAVE "NAME"`      | the tokenized program area, verbatim   |
| `0xEA` | `SAVE "CAS:NAME",A` | the listing as text, ending `0x1A`     |
| `0xD0` | `BSAVE "CAS:NAME"`  | a machine-code file with load/end/exec |

That the counts are ten and six is the machine's own: the ROM's writer emits ten
markers and six name bytes, and its reader demands exactly that back. The IDE
exports the `0xD3` form and reads all three, telling a `.cas` from a `.bas` by
the block marker rather than by the extension it arrived under — so a tape image
dropped on the editor opens as one whichever way it is named. An ASCII tape opens
as a listing; a `BSAVE` tape is reported rather than pasted into the editor as
nonsense.

The data block ends in **seven repeats of the program's last byte**, because
that is what the ROM's writer does. A tokenized program ends in its zero link, so
those seven bytes are zeros, and a `.cas` in the wild carries them.

There is **no checksum anywhere on an MSX tape**. The framing is the only check
the format has, which is why a bad recording on real hardware gives nonsense
rather than an error.

## Cassette audio

The MSX exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz, and the
audio carries exactly the blocks of the `.cas` above.

The encoding is the **Kansas City Standard** at 1200 baud: a `0` bit is one cycle
of 1200 Hz and a `1` bit two cycles of 2400 Hz, behind a 2400 Hz leader. The
machine works out 1200 against 2400 baud as it reads, so a recording does not
have to say which it is.

Two things about the framing are the MSX's own rather than the family's, and
both matter to anything trying to read one of these tapes. A byte carries **two**
stop bits, not one: the ROM writes the start bit, rotates the eight data bits out
least-significant first, and then calls its `1` writer twice — so MSX frames 8N2
where the rest of the Kansas City family frames 8N1, and decoding one as the
other slips a bit every byte. And a header tone is a whole number of 2400 Hz
cycles counted from a work-area byte the machine boots holding 15: 15360 cycles
(6.4 seconds) before a file's header block and 3840 (1.6 seconds) before its
data.

What the IDE writes is shorter. A real tape leader is long because a cassette
motor takes seconds to reach speed; a sound card playing straight into the
machine needs only enough tone for the reader to lock onto, and shorter leaders
are what keep an exported `.wav` a practical size. The 4:1 ratio between the two
headers is kept, because that is what tells the reader a file is starting rather
than continuing. "Robust" mode doubles both for temperamental hardware.

On a real HB-10P, type `CLOAD"NAME"` and press RETURN, then start playback; when
`Ok` comes back, type `RUN`. `RUN"CAS:NAME"` does both in one go. To save, press
RECORD and PLAY on the recorder, then type `CSAVE"NAME"` and press RETURN.
