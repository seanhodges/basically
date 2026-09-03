---
title: Integer BASIC reference
---

<script setup>
import { integerBasicReference } from '../../src/reference/integer-basic';
</script>

# Integer BASIC reference

Every command, function and operator in Integer BASIC — Woz's interpreter, in
two revisions: **Apple 1 Integer BASIC**, written in 1976 for the machine it ran
on, and **Apple II Integer BASIC**, in the 1977 machine's ROM sockets with the
colour graphics, cursor and cassette the Apple I never had.

Rows the Apple II added are badged **Apple II only** in the table below, and the
four the Apple I kept for itself — `HIMEM=`, `LOMEM=`, `OFF` and `SCR` — are
badged **Apple I only**. Everything else is on both machines, and where the two
behave differently the row says how.

**In this reference:** [Hardware](./integer-basic/hardware) · [Escape codes](./integer-basic/escapes) · [File formats](./integer-basic/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- **This is not Applesoft.** The BASIC most Apple II programs were written in
  came later, on tape and then in the II Plus's ROM. Nothing of it is here: no
  floating point, no `HGR` or `HPLOT`, no `CHR$`, `MID$` or `STR$`, no
  `DATA`/`READ`, no `ONERR` and no `DEF FN`. A listing using any of them is
  Applesoft, and has [a reference of its own](./applesoft).
- **Variable names differ between the two machines.** On the Apple I a name is
  one letter and at most one digit: `A` and `A1` are variables, while `AB` and
  `A12` are each a syntax error, and a string variable is a bare letter with
  `$`. This is the tightest naming of any machine here. On the Apple II a name
  may be as long as you like, but `AND`, `AT`, `MOD`, `OR`, `STEP`, `THEN` and
  `TO` end a name where they appear in it from the second character on — `RATE`
  is read as `RA`, `TO` and a syntax error, while `TOTAL` and `ANDY` are fine.
- Numbers are 16-bit signed integers, −32767 to 32767, and `/` truncates towards
  zero, so `7/2` is 3. There is no floating point and no maths library. The
  Apple II raises to a power with `^`; the Apple I has **no power operator** —
  `^` has a token and reaches no handler, so a program using it stops there and
  never returns, and the editor refuses it rather than letting that happen.
- A string must be `DIM`ed before use, and assigning at a position **truncates
  what follows** — `A$(5)="X"` leaves a five-character string. There is no
  concatenation: a string is extended by assigning past its end, as
  `A$(LEN(A$)+1)="C"`. Strings compare with `=` and `#` and nothing else.
- `AND`, `OR` and `NOT` reduce their operands to a truth value rather than
  combining bits: `5 AND 3` and `5 OR 3` are both `1`, and `NOT 5` is `0`. A
  true comparison is `1`, not `-1`. `#` is this BASIC's "not equal"; `<>` is
  accepted as well, for numbers only.
- Multiple statements per line are allowed with `:`, and line numbers run 0 to 32767. What limits an Apple II line is the entry buffer, which holds the text
  and the tokens made from it at once: together they may reach 255, and at 256
  the machine answers `*** TOO LONG ERR`.
- `PEEK`, `POKE` and `CALL` take **signed decimal** addresses — there is no
  hexadecimal notation anywhere in this BASIC, which is why an I/O address is
  written negative. `PEEK(-12272)` reads the Apple I's keyboard and
  `PEEK(-16384)` the Apple II's.

<ReferenceTable :data="integerBasicReference" />

## The preamble a listing opens with

An Integer BASIC listing is not only numbered lines. The commands the
interpreter takes at its `>` prompt are written above the program, and often a
bare `RUN` below it. Paste one in as it stands: a line with no number is
accepted anywhere in the program as long as it holds one of those commands, and
anything else without a number is still an error.

### On the Apple I

```
SCR
LOMEM=768
HIMEM=4096
10 PRINT "HELLO"
20 END
RUN
```

Nine commands may stand on an unnumbered line: `SCR`, `CLR`, `RUN`, `LIST`,
`DEL`, `AUTO`, `OFF`, `LOMEM=` and `HIMEM=`. The same nine are refused inside a
numbered line.

`LOMEM=` and `HIMEM=` are the two that change anything. They set the workspace
the program is built into and loaded with — the area the program grows down
through and its variables grow up through — so `LOMEM=768` gives a program 3328
bytes instead of the stock 2048. Bounds the machine could not hold are reported
where they are written: the workspace has to sit above the monitor's input
buffer at `$0280` and inside the 4K of RAM the machine has fitted, and its top
has to be above its bottom. Where the same bound is set twice, the last one is
the one that takes effect.

Lowering `LOMEM` claims the free RAM a machine-code block would otherwise use.
`$0300`–`$07FF` is the only RAM Integer BASIC never touches on a stock machine,
so a program cannot both move `LOMEM` down there and keep a block.

The other seven — `SCR`, `CLR`, `RUN`, `LIST`, `DEL`, `AUTO` and `OFF` — are
kept with the program and change nothing about it. A program built here is
already scratched and holds no variables, and the IDE starts it for you.

A cassette export writes the workspace into the dump alongside the program, and
importing one restates whatever `LOMEM=` and `HIMEM=` it was saved with — but
note that the monitor range you type at a real machine follows those bounds too,
which is why the Transfer dialog spells the range out rather than always saying
`800.FFF`.

### On the Apple II

```
NEW
HIMEM:16384
10 PRINT "HELLO"
20 END
RUN
```

Twelve commands may stand on an unnumbered line: `AUTO`, `CLR`, `CON`, `DEL`,
`HIMEM:`, `LOAD`, `LOMEM:`, `MAN`, `NEW`, `RUN`, `SAVE`, and `LIST`, which is
legal in both places. The other eleven are refused inside a numbered line.

`LOMEM:` and `HIMEM:` are the two that change anything. They set the workspace
the program is built into: the program grows **down** from HIMEM and the
variables grow **up** from LOMEM, and the two meeting is `*** MEM FULL ERR`.
The cold start puts them at 2048 and the top of RAM, which is the whole 47104
bytes, so a listing sets them to make room for something else rather than to
make room for itself — a machine-code block below LOMEM, say. Bounds the machine
could not hold are reported where they are written, and where the same bound is
set twice the last one takes effect.

The other commands are kept with the program and change nothing about it: what
is built here is already erased and holds no variables, and the IDE starts it
for you.

One thing the preamble is not is part of the tape. A cassette record holds the
program and its length and nothing else, so `HIMEM:` is typed at a real machine
**before** `LOAD` rather than after it — which is why the Transfer dialog spells
those bounds out for a program that moved them.

### Either way

The preamble is part of the program text, so renumbering leaves it where it is
and the assistant will not drop it.

## What this machine does not run

`COLOR=`, `PLOT`, `HLIN` and `AT` are in the Apple I's syntax table, left over
from Woz's work towards the Apple II, and reach a machine with no graphics
hardware. `USR` parses and jumps to address 0. `HIMEM`, `LOMEM` and `COLOR`
used as expressions all evaluate to 0. None of them is offered as a keyword on
that machine, and the editor names each one rather than reporting an unknown
word. On the Apple II the same four graphics commands are real, and are in the
table below.
