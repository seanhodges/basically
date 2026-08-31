---
title: Apple II Integer BASIC reference
---

<script setup>
import { apple2Reference } from '../../src/reference/apple2';
</script>

# Apple II Integer BASIC reference

Every command, function and operator in Apple II Integer BASIC — Woz's
interpreter in the 1977 machine's ROM sockets, one revision on from the Apple 1's
and with the colour graphics, cursor and cassette that machine never had.

**In this reference:** [Hardware](./apple2/hardware) · [Escape codes](./apple2/escapes) · [File formats](./apple2/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- **This is not Applesoft.** The BASIC most Apple II programs were written in
  came later, on tape and then in the II Plus's ROM. Nothing of it is here:
  no floating point, no `HGR`, `HPLOT` or `DRAW`, no `CHR$`, `MID$`, `LEFT$`,
  `STR$` or `VAL`, no `DATA`/`READ`, no `GET`, `HOME`, `ONERR` or `DEF FN`, and
  no `ON … GOTO`. A listing that uses any of them is Applesoft and will not run.
- A variable name may be as long as you like — `SCORE` and `COUNT` are fine —
  but `AND`, `AT`, `MOD`, `OR`, `STEP`, `THEN` and `TO` end a name where they
  appear in it from the second character on. `RATE` is read as `RA`, `TO` and a
  syntax error, while `TOTAL` and `ANDY` are ordinary variables, a keyword at the
  first character not being one of these matches. A string variable is a name
  and `$`.
- Numbers are 16-bit signed integers, −32767 to 32767, and `/` truncates towards
  zero, so `7/2` is 3 and `-7/2` is −3. There is no floating point and no maths
  library: no `SQR`, `LOG`, `EXP` or trigonometry, and `RND(N)` gives a whole
  number from 0 to N−1. `MOD` is the remainder, and `^` raises to a power.
- A string must be `DIM`ed before use, holds at most 255 characters, and
  assigning at a position **truncates what follows** — `A$(5)="X"` leaves a
  five-character string. Reading is not the same shape as writing: `A$(2,4)` is
  characters 2 to 4 and `A$(3)` is 3 to the end, both counting from 1. There is
  no concatenation, so a string is extended by assigning past its end, as
  `A$(LEN(A$)+1)="C"`.
- Strings compare with `=` and `#` and nothing else: `IF A$<B$` is a syntax
  error. `LEN(` and `ASC(` are the only string functions, and `ASC(` answers with
  bit 7 set — `ASC("H")` is 200 — because that is how the machine stores a
  character.
- Numeric arrays are one-dimensional and indexed from 0, so `DIM A(3)` holds
  four numbers. There are no string arrays and nothing two-dimensional, and an
  array used without a `DIM` answers `*** RANGE ERR`.
- `AND`, `OR` and `NOT` reduce their operands to a truth value rather than
  combining bits: `5 AND 3` and `5 OR 3` are both `1`, and `NOT 5` is `0`. A true
  comparison is `1`, not `-1`. `#` is this BASIC's "not equal"; `<>` is accepted
  as well, for numbers only.
- Falling off the last line reports `*** NO END ERR`, so every program ends with
  `END`.
- Multiple statements per line are allowed with `:`, and line numbers run 0 to 32767. What limits a line is the machine's entry buffer, which holds the text
  being read and the tokens produced from it at once: their lengths together may
  reach 255, and at 256 the machine answers `*** TOO LONG ERR`.
- Upper case only: the interpreter refuses a lower-case name or keyword, and the
  character generator has no lower-case shapes to draw. There is no abbreviation
  of any kind — not even `?` for `PRINT`.
- `PEEK`, `POKE` and `CALL` take **signed decimal** addresses. There is no
  hexadecimal notation anywhere in this BASIC, which is why an address above
  32767 is written negative — `PEEK(-16384)` reads the keyboard.

## The preamble a listing opens with

An Apple II listing is not only numbered lines. Eleven commands the interpreter
takes at its `>` prompt are refused inside a numbered line, and a printed listing
writes them above the program, often with a bare `RUN` below it:

```
NEW
HIMEM:16384
10 PRINT "HELLO"
20 END
RUN
```

Paste that in as it stands. A line with no number is accepted anywhere in the
program as long as it holds one of those commands — `AUTO`, `CLR`, `CON`, `DEL`,
`HIMEM:`, `LOAD`, `LOMEM:`, `MAN`, `NEW`, `RUN`, `SAVE`, and `LIST`, which is
legal in both places — and anything else without a number is still an error.

`LOMEM:` and `HIMEM:` are the two that change anything. They set the workspace
the program is built into: the program grows **down** from HIMEM and the
variables grow **up** from LOMEM, and the two meeting is `*** MEM FULL ERR`.
The cold start puts them at 2048 and the top of RAM, which is the whole 47104
bytes, so a listing sets them to make room for something else rather than to make
room for itself — a machine-code block below LOMEM, say. Bounds the machine
could not hold are reported where they are written, and where the same bound is
set twice the last one takes effect.

The other commands are kept with the program and change nothing about it: what
is built here is already erased and holds no variables, and the IDE starts it for
you. The preamble is part of the program text, so renumbering leaves it where it
is and the assistant will not drop it.

One thing the preamble is not is part of the tape. A cassette record holds the
program and its length and nothing else, so `HIMEM:` is typed at a real machine
**before** `LOAD` rather than after it — which is why the Transfer dialog spells
those bounds out for a program that moved them.

<ReferenceTable :data="apple2Reference" />
