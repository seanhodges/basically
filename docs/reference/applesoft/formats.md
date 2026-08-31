---
title: Applesoft BASIC file formats
---

# Applesoft BASIC file formats

Applesoft has `SAVE` and `LOAD` in the language, so the Apple II Plus has a
program file of its own: the **cassette record** the program goes out as. The IDE
exports that record as **`.bin`**, exports the same program modulated as cassette
**`.wav`** audio, and takes either back. The listing also exports as plain-text
**`.bas`**, which is how a program moves between this IDE and anything that is not
an Apple II. For the shared editor `.txt`, the project bundle, escape notation and
the cross-machine machine-code overview, see the
[file formats overview](../file-formats).

No Apple II Plus export carries
[memory blocks](../file-formats#machine-code-data-blocks). `SAVE` writes the
program workspace and nothing else, and a block sits on page 3, outside it —
widening the file would make something the machine could not read back. Use the
`.zip` project bundle to keep a program and its blocks together.

## Apple II Plus cassette record `.bin`

The file is the program: the tokenized linked list exactly as it sits at 2049,
with no header in front of it.

```
[ program text : link, line number, tokens, 0x00 … then a zero link ]
```

That is the whole of it, and it is the same shape the machine holds in memory,
because Applesoft's linked list describes itself — each line carries the absolute
address of the next, and a zero link ends the program. The sibling Apple II's
`.bin` needs a two-byte length in front because its interpreter grows the program
_down_ from `HIMEM:` and has to be told how far; this one always starts at 2049,
so there is nothing to say.

That fixed base is what makes the format portable in a way the sibling's is not.
A program does not remember the `HIMEM:` and `LOMEM:` it was written under and
does not need to: it lands at 2049 on any Apple II Plus, whatever memory the
machine has. There is still no name in the file, and none on the tape either.

## Cassette audio

The Apple II Plus exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic or line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1kHz.

The modulation is the monitor's rather than the interpreter's: `SAVE` and `LOAD`
call `WRITE` at `$FECD` and `READ` at `$FEFD`, and those two routines are byte for
byte the same code in this machine's ROM as in the Apple II's. So an Apple II Plus
tape sounds exactly like an Apple II tape, and a recorder that reads one reads the
other.

A bit's **length** carries its value: one cycle of about 2 kHz is a zero, one
cycle of about 1 kHz is a one, and bytes go out most significant bit first. In
front of each record is a leader of slower phases, about 780 Hz, ending in one
short half-cycle — the sync bit, and the only mark on the tape that says where the
data begins. Each record ends with a checksum byte, the exclusive-OR of everything
in it; `LOAD` compares it and answers `ERR` when it does not match.

Where a tape differs from the `.bin` file is that `SAVE` writes **two** records,
each behind a leader of its own:

- a **three-byte header record** — the program's length, little-endian, and then
  a third byte that `LOAD` stores in location 214. Its value hardly matters but
  its top bit does: set it, and `LOAD` skips the relink it otherwise does on a
  loaded program, which leaves the interpreter describing the program that was
  there before. On a real machine the byte is whatever the string-temporary
  pointer happened to hold, which at the `]` prompt has that bit clear.
- the **program record**, which runs one byte past the program's own end. `SAVE`
  writes as far as the first byte of the variables, and `READ` reads the same
  range back, so a record trimmed to the program alone leaves a real machine
  hunting for a byte that is not there and answering `ERR`.

Where the two machines differ audibly is how much leader they spend. The Apple
II's Integer BASIC re-enters `WRITE` past its own leader count for the second
record and gives it a shorter one, so its two leaders run about ten and a half
seconds and then about four. Applesoft calls `WRITE` from the top both times, so
**both** leaders are the long one: about ten and a half seconds each, and an
Applesoft tape spends some twenty-one seconds on leader tone before it has
finished writing a program of any size. Neither leader could be trimmed much
anyway — `READ` spends its first four seconds letting the tape speed settle before
it starts hunting for a sync bit, so a leader shorter than that is never heard at
all.

Robust mode doubles both leaders and changes nothing else: the bit timings belong
to the ROM, and a reader that cannot follow them is not helped by stretching them.

Decoding measures every threshold against the leader it has just heard rather than
against absolute durations, so a recording made at another sample rate, or played
back by a recorder running off speed, still reads. The machine's own read routine
instead counts a fixed number of loops, which is why a real Apple is famously fussy
about tape speed. A checksum mismatch is reported as a warning rather than throwing
the data away, so a damaged tape still shows what it held.

On a real Apple II Plus, save with `SAVE` at the `]` prompt once the recorder is
running, and load by starting playback and typing `LOAD` — there is no need to wait
for the leader tone to finish. It beeps once for the header record and once for the
program; `LIST` or `RUN` it when the second beep comes. `ERR` before a beep is the
checksum failing: rewind and try again with the volume a little lower. Unlike the
Apple II next door, nothing needs typing before the `LOAD`: the program's address
is fixed, so the tape carries everything the machine needs.

See also the [Applesoft BASIC reference](../applesoft), its
[escape codes](./escapes) and the [hardware](./hardware) page.
