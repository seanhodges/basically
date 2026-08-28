---
title: Atari file formats
---

# Atari file formats

The Atari writes its programs two ways and the IDE exports both, because they
are not interchangeable. `SAVE` writes the **tokenized image** — a pre-parsed
structure the machine can load instantly — and the IDE exports it as **`.bas`**.
`LIST` writes an **ATASCII listing**, plain text that `ENTER` reads back a line
at a time, exported as **`.lst`**. Either can go to the cassette recorder, and
the tape forms carry the tokenized image: **`.cas`** for an emulator's virtual
recorder and **`.wav`** for a real one.

No Atari export carries
[memory blocks](../file-formats#machine-code-data-blocks). A block sits in page
6, which is outside what `SAVE` and `CSAVE` write — the machine's own save
routines write BASIC's program area and nothing else — so use the `.zip` project
bundle to keep a program and its blocks together.

For the shared editor `.txt`, the project bundle, escape notation and the
cross-machine machine-code overview, see the
[file formats overview](../file-formats). See also the
[Atari BASIC reference](../atari) and its [escape codes](./escapes).

## Atari tokenized program `.bas`

Atari BASIC does not hold a line as a string of tokens the way the
Microsoft-family machines do. It holds a **pre-parsed structure**: the variables
a program mentions are lifted out into two tables of their own and referred to
by index, and every line carries the offsets the interpreter needs to skip a
statement without scanning it. `SAVE` writes that structure out whole:

```
header   7 words, each a pointer relative to LOMEM, so the first is always 0
VNT      the variable names, top bit set on the last character of each
VNTD     one zero byte, the name table's end marker
VVT      8 bytes per variable, in the same order as the names
STMTAB   the program: one record per line, in ascending line order
STMCUR   the immediate-mode line, which sits just past the program
```

The saved bytes start at VNTP rather than at LOMEM: the 256 bytes between them
are the buffer BASIC parses a typed line into, and hold nothing worth keeping.
That gap is why the second pointer in the header is 256 rather than zero, and it
is the part of the file a reader is most likely to get wrong.

Each line record is a two-byte line number, a one-byte length, and then its
statements — each of which is a one-byte offset to the next, a statement token,
and the expression tokens after it. A number inside a statement is a token
followed by six bytes of binary-coded decimal; a string is a token followed by a
length byte and that many ATASCII characters. Variables are not tokens at all:
they are 128 plus the variable's index into the name table, which is why a
program may name at most 128 of them.

Importing a `.bas` reads the structure back and rebuilds the listing from it, so
the file opens as the machine would have listed it — keywords spelled in full,
with the spacing the parser puts back — rather than as it happened to be typed.

Because `.bas` is also the extension the editor accepts as plain text, a
tokenized `.bas` dropped onto the editor arrives as mojibake: the drop handler
reads text first. Use **Import → "Import tokenized .BAS…"**, which asks the
dialect instead of guessing from the name. `.lst` and `.cas` have no such
collision and can be dropped straight in.

## Atari listing `.lst`

The program as text rather than as a structure: no header, no variable tables,
one line per record ended by `{eol}` — code 155, which is this machine's end of
line. It is what `LIST "D:PROGRAM.LST"` or `LIST "C:"` writes, and what `ENTER`
reads back.

The bytes are ATASCII rather than ASCII, so the graphics characters and the
inverse video a listing may carry inside a string survive the round trip; only
the line ending differs from what the editor holds. That makes `.lst` the
portable form — `ENTER` reads it on any Atari whatever BASIC is fitted, and it
merges into the program already in memory rather than replacing it, which is how
two listings are joined.

## Atari cassette `.cas`

The Atari has no tape format of its own the way the Sinclair and Commodore
machines do. `CSAVE` hands the program to the operating system's I/O layer,
which hands it to the serial bus, and the cassette handler cuts the stream into
fixed **132-byte records**. Every record has the same shape whatever it carries:

```
0x55 0x55   two sync bytes, which the reader times its baud rate off
control     0xFC full, 0xFA the last one, 0xFE end of file
128 bytes   the payload; a partial record's last byte is its byte count
checksum    every byte above, summed with the carry added back in
```

There is no filename and no load address anywhere on the tape. The recorder is a
single device with no directory, so what a tape holds is decided by what the
person at the keyboard typed to start it — which is why importing a tape brings
back a program with no name of its own. A `CSAVE`d tape holds exactly the bytes
`SAVE` writes: the pointer header and the program area behind it.

`.cas` wraps those records in the chunked container an emulator's virtual
recorder reads, each chunk being a four-byte type, a 16-bit length, a 16-bit
auxiliary word and the chunk's data. The container's FUJI chunk carries a
description, and it is the only place a document's name survives the trip.

## Cassette audio

The Atari exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic or line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1 kHz, and the
audio carries exactly the records the `.cas` above holds.

The signal is plain **FSK at 600 baud**: one tone per bit level, rather than the
cycle counting the Kansas City machines do. Both tones come from dividing
POKEY's 64 kHz clock — **5327 Hz** is a mark, a `1` bit, and **3995 Hz** is a
space, a `0`. Bytes are framed 8-N-1: a space start bit, eight data bits least
significant first, and a mark stop bit. A continuous mark tone leads in and
separates the records.

A bit is not a whole number of cycles of either tone — a mark bit is 8.88 of
them — so the waveform runs off a continuous phase, changing tone at the bit
boundary and carrying on from wherever it had got to, exactly as a divider being
reprogrammed does.

The two tones are close enough together that they cannot be told apart by
measuring half-cycles: at 44.1 kHz a mark half-cycle is four samples and a space
half-cycle five. The decoder correlates against both tones over a whole bit
instead, and measures the bit period off the `0x55 0x55` sync bytes at the head
of each record — which is what those bytes are there for, and what lets a
recording survive a wrong sample rate or a tape running slow.

A real `CSAVE` leads in with 19.2 seconds of tone, because a cassette motor
takes that long to settle. A sound card playing straight into the machine needs
only enough for the reader to lock on, so the export uses a five-second leader
and `CSAVE`'s own quarter-second inter-record gap; robust mode doubles both for
a noisier path, such as a phone speaker held to the machine's microphone socket.

On a real Atari, save with `CSAVE` and RETURN — the machine beeps twice — then
press RECORD and PLAY on the recorder and press RETURN again. Load with `CLOAD`
and RETURN — one beep — then start playback and press RETURN; type `RUN` when
`READY` comes back.
