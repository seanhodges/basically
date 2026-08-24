---
title: Apple 1 Integer BASIC reference
---

<script setup>
import { apple1Reference } from '../../src/reference/apple1';
</script>

# Apple 1 Integer BASIC reference

Every command, function and operator in Apple 1 Integer BASIC — Woz's 1976
interpreter, written for the machine it ran on rather than for the Apple II that
followed it.

**In this reference:** [Hardware](./apple1/hardware) · [Escape codes](./apple1/escapes) · [File formats](./apple1/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- A variable name is **one letter and at most one digit**. `A` and `A1` are
  variables; `AB`, `ABC` and `A12` are each a syntax error, and a string
  variable is a bare letter with `$`, so `A1$` is refused too. This is the
  tightest naming of any machine here.
- A string is a fixed buffer: `DIM` it before use, and note that assigning at a
  position truncates what follows, so `A$(5)="X"` leaves a five-character
  string. There is no concatenation, and `LEN` is the only string function.
- Numbers are 16-bit signed integers, −32767 to 32767. There is no floating
  point, so `/` truncates and there is no `SQR`, `LOG`, `EXP` or trigonometry.
- `AND`, `OR` and `NOT` reduce their operands to a truth value rather than
  combining bits: `5 AND 3` and `5 OR 3` are both `1`, and `NOT 5` is `0`. A
  true comparison is `1`, not `-1`. `#` is this BASIC's "not equal"; `<>` is
  accepted as well.
- There is **no power operator**. `^` has a token in the interpreter's syntax
  table and reaches no handler, so a program using it stops at that statement
  and never returns; the editor refuses it rather than letting that happen.
- Multiple statements per line are allowed with `:`, and line numbers run 0 to 32767. There is no abbreviation of any kind — not even `?` for `PRINT`.
- `HIMEM=` and `LOMEM=` take `=`, not the Apple II's `:`, and they — along with
  `LIST`, `RUN`, `DEL`, `AUTO`, `OFF`, `SCR` and `CLR` — are refused inside a
  numbered line. On a line of their own with no line number, which is how a
  printed listing writes them, all nine are accepted: see
  [the preamble](#the-preamble-a-listing-opens-with) below.
- Falling off the last line reports `*** END ERR`. The program stops cleanly
  either way, but a listing that ends without `END` leaves a report on screen.
- Upper case only: the interpreter refuses a lower-case name or keyword, and
  the character generator has no lower-case shapes to draw.
- `PEEK`, `POKE` and `CALL` take **signed decimal** addresses. There is no
  hexadecimal notation anywhere in this BASIC, which is why an I/O address is
  written negative — `PEEK(-12272)` reads the keyboard.

## The preamble a listing opens with

An Apple 1 listing is not only numbered lines. The commands the interpreter
takes at its `>` prompt are written above the program, and often a bare `RUN`
below it:

```
SCR
LOMEM=768
HIMEM=4096
10 PRINT "HELLO"
20 END
RUN
```

Paste that in as it stands. A line with no number is accepted anywhere in the
program as long as it holds one of those nine commands; anything else without a
number is still an error, and the same nine are still refused inside a numbered
line.

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

The preamble is part of the program text, so renumbering leaves it where it is
and the assistant will not drop it. A cassette export writes the workspace into
the dump alongside the program, and importing one restates whatever `LOMEM=` and
`HIMEM=` it was saved with — but note that the monitor range you type at a real
machine follows those bounds too, which is why the Transfer dialog spells the
range out rather than always saying `800.FFF`.

## What is in the interpreter but does not work

`COLOR=`, `PLOT`, `HLIN` and `AT` are in the syntax table, left over from Woz's
work towards the Apple II, and reach a machine with no graphics hardware.
`USR` parses and jumps to address 0. `HIMEM`, `LOMEM` and `COLOR` used as
expressions all evaluate to 0. None of them is offered as a keyword, and the
editor names each one rather than reporting an unknown word.

<ReferenceTable :data="apple1Reference" />
