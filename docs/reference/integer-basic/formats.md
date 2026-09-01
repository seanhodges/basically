---
title: Integer BASIC file formats
---

# Integer BASIC file formats

The two machines that run [Integer BASIC](../integer-basic) carry a program
quite differently, because only the later one has the language to do it: the
Apple I saves memory ranges through the monitor, the Apple II saves a cassette
record from BASIC. Each has a section of its own below.

For the shared editor `.txt`, the project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the
[Integer BASIC reference](../integer-basic) and its [escape codes](./escapes).

## The Apple I

The Apple I has no program container of its own, because Integer BASIC has no
`LOAD` and no `SAVE`. A program is saved by leaving BASIC for the monitor and
dumping **two ranges of memory** through the cassette interface, and read back by
giving the monitor the same two ranges. That dump is what this machine's native
file is: the IDE exports it as **`.bin`**, exports the same two ranges as
cassette **`.wav`** audio, and takes either back. The listing also exports as a
plain-text **`.bas`**, which on a machine with no tape command in BASIC is a
transfer route rather than a fallback — typing or pasting a listing back in is
how a program moves between an Apple I and anything else.

No Apple I export carries
[memory blocks](../file-formats#machine-code-data-blocks): a block sits below
`LOMEM`, and the ranges the cassette interface writes start at the workspace.
Use the `.zip` project bundle to keep a program and its blocks together.

### Apple I cassette dump `.bin`

The Apple Cassette Interface is a card on the expansion connector with a
256-byte program of its own at `0xC100`. Started from the monitor with `C100R`,
it takes the same address-range syntax the monitor uses, with `W` to write and
`R` to read:

```
C100R              start the cassette interface
4A.FF W            the housekeeping block
800.FFF W          the program and variable area
```

Two ranges, because a program on this machine is not one contiguous thing. The
second range is the workspace itself — variables up from LOMEM at `0x0800`, the
program text down from HIMEM at `0x0FFF` — and the first is the zero-page
housekeeping that says where in it each of those begins: LOMEM at `0x4A`, HIMEM
at `0x4C`, the bottom of the program text at `0xCA` and the top of the variables
at `0xCC`. `800.FFF` is the stock workspace: a program that sets its own with a
[`LOMEM=` / `HIMEM=` preamble](../integer-basic#the-preamble-a-listing-opens-with) is
written and read over the range **its** bounds describe, and the Transfer dialog
spells that range out for you. Without the pointers the workspace is a block of
bytes nobody can
find the program in.

The `.bin` export is those two ranges laid end to end — 182 bytes of
housekeeping, then the 2048-byte workspace — and importing one reads the
pointers to find the program text, so a dump made with a different `LOMEM` or
`HIMEM` opens as readily as a stock one. `.bin` because the interface never
claimed an extension: it writes memory, not files.

Reading a tape back is the same two ranges with `R` in place of `W`, in the same
order. There is no name, no length field, no checksum and no directory: an ACI
tape is a memory range, and the person holding it is expected to know which.

### Cassette audio

The Apple I exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz, and the
audio carries exactly the two ranges the `.bin` above holds.

The card is a square-wave generator and nothing else, so a bit's **duration**
carries its value: one cycle of about 2 kHz is a zero, one cycle of about 1 kHz
is a one, and bytes go out most significant bit first. In front of each range is
about ten seconds of a slower leader tone, ending in one short half-cycle — the
start bit, and the only thing that tells a reader where the data begins. Each
range is written by its own `W` command, so a full dump is leader, housekeeping
block, leader, workspace, and takes something over half a minute to play.

Ten seconds of leader is not padding: the card's read routine spends its first
three seconds letting the tape speed settle before it starts hunting for the
start bit, which is why the recorder is started first and `Return` pressed part
way into the tone. Robust mode doubles the leader and changes nothing else —
the bit timings belong to the card, and a reader that cannot follow them is not
helped by stretching them. Decoding measures every threshold against the leader
it has just heard rather than against absolute durations, so a recording made at
another sample rate, or played back by a recorder running off speed, still
reads.

On a real Apple I, save with `C100R` and then `4A.FF W 800.FFF W`, and load with
the same two ranges and `R` — pressing `Return` once playback has reached the
steady leader tone. Both ranges are the machine's own: `4A.4D` at the monitor
reads LOMEM and HIMEM back, and `800.FFF` is right only for a program that never
moved them. The monitor answers `\` when both ranges are in; `E2B3R`
re-enters BASIC with the program there to `LIST` or `RUN`. The emulated machine
here has no cassette card fitted, as most Apple I boards did not, so `C100R` on
it runs into empty address space. Import and export in the IDE work on the file
and the audio directly, without going through the emulator, so neither needs the
card.

## The Apple II

Integer BASIC has `SAVE` and `LOAD` in the language, so unlike the Apple 1 this
machine has a program file of its own: the length-prefixed **cassette record**
that `SAVE` writes. The IDE exports that record as **`.bin`**, exports the same
record modulated as cassette **`.wav`** audio, and takes either back. The listing
also exports as plain-text **`.bas`**, which is how a program moves between this
IDE and anything that is not an Apple II.

### Apple II cassette record `.bin`

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
[unnumbered preamble](../integer-basic#the-preamble-a-listing-opens-with) the listing
itself writes.

Importing a file whose two-byte header does not describe the rest of it is not
refused: the whole file is read as program text instead and the import says so,
so a truncated tape still shows what it held.

### Cassette audio

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

See also the [Apple II Integer BASIC reference](../integer-basic), its
[escape codes](./escapes) and the [hardware](./hardware) page.
