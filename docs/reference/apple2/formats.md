---
title: Apple II file formats
---

# Apple II file formats

Integer BASIC has `SAVE` and `LOAD` in the language, so unlike the Apple 1 this
machine has a program file of its own: the length-prefixed **cassette record**
that `SAVE` writes. The IDE exports that record as **`.bin`**, exports the same
record modulated as cassette **`.wav`** audio, and takes either back. The listing
also exports as plain-text **`.bas`**, which is how a program moves between this
IDE and anything that is not an Apple II. For the shared editor `.txt`, the
project bundle, escape notation and the cross-machine machine-code overview, see
the [file formats overview](../file-formats).

No Apple II export carries
[memory blocks](../file-formats#machine-code-data-blocks). `SAVE` writes the
program workspace and nothing else, and a block sits on page 3, outside it —
widening the file would make something the machine could not read back. Use the
`.zip` project bundle to keep a program and its blocks together.

## Apple II cassette record `.bin`

`SAVE` and `LOAD` define the format between them. `SAVE` works out how long the
program text is, writes those two bytes as a record of their own, and then writes
the text; `LOAD` reads the two bytes back, puts the program at the top of the
workspace and reads that many bytes down into it. So the file is:

```
[ length lo ][ length hi ][ program text : length bytes ]
```

Two bytes and then the tokens, little-endian, and `.bin` because the format never
claimed an extension of its own.

The consequence worth knowing is what is **not** in it: the workspace bounds. A
program does not remember the `LOMEM:` and `HIMEM:` it was written under — it
lands at the top of whatever workspace the loading machine already has, which is
why a real Apple II owner types the bounds before `LOAD` rather than after. Where
the IDE needs to carry those bounds it carries them in the source text, as the
[unnumbered preamble](../apple2#the-preamble-a-listing-opens-with) the listing
itself writes.

Importing a file whose two-byte header does not describe the rest of it is not
refused: the whole file is read as program text instead and the import says so,
so a truncated tape still shows what it held.

## Cassette audio

The Apple II exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic or line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz.

The modulation is Woz's, and a bit's **length** carries its value: one cycle of
about 2 kHz is a zero, one cycle of about 1 kHz is a one, and bytes go out most
significant bit first. In front of each record is a leader of slower phases,
about 780 Hz, ending in one short half-cycle — the sync bit, and the only mark on
the tape that says where the data begins. Each record ends with a checksum byte,
the exclusive-OR of everything in it; `LOAD` compares it and answers `ERR` when
it does not match.

`SAVE` writes **two** records, each behind a leader of its own: the two-byte
length, then the program text. The first leader runs about ten and a half seconds
and the second about four, which is why the second is audibly the shorter. Neither
can be trimmed much: `LOAD` spends its first three and a half seconds letting the
tape speed settle before it starts hunting for a sync bit, so a leader shorter
than that is never heard at all.

Robust mode doubles both leaders and changes nothing else: the bit timings belong
to the ROM, and a reader that cannot follow them is not helped by stretching
them.

Decoding measures every threshold against the leader it has just heard rather
than against absolute durations, so a recording made at another sample rate, or
played back by a recorder running off speed, still reads. The machine's own read
routine instead counts a fixed number of loops, which is why a real Apple II is
famously fussy about tape speed. A checksum mismatch is reported as a warning
rather than throwing the data away, so a damaged tape still shows what it held.

On a real Apple II, save with `SAVE` at the `>` prompt once the recorder is
running, and load by starting playback and typing `LOAD` — there is no need to
wait for the leader tone to finish. It beeps once for the length record and once
for the program; `LIST` or `RUN` it when the second beep comes. `ERR` before a
beep is the checksum failing: rewind and try again with the volume a little
lower. A program that moved its own workspace needs its `LOMEM:` and `HIMEM:`
typed **before** the `LOAD`, since the tape does not carry them.

See also the [Apple II Integer BASIC reference](../apple2), its
[escape codes](./escapes) and the [hardware](./hardware) page.
