---
title: Apple I file formats
---

# Apple I file formats

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

For the shared editor `.txt`, the project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the
[Apple 1 Integer BASIC reference](../apple1) and its [escape codes](./escapes).

## Apple I cassette dump `.bin`

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
[`LOMEM=` / `HIMEM=` preamble](../apple1#the-preamble-a-listing-opens-with) is
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

## Cassette audio

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
