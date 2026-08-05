---
title: Altair 8K BASIC reference
---

<script setup>
import { altair8800Reference } from '../../src/reference/altair8800';
</script>

# Altair 8K BASIC reference

Every command, function and operator in Altair 8K BASIC — the 1975–76 MITS
interpreter that every later Microsoft BASIC descends from.

## Notes and caveats

- Multiple statements per line are allowed with `:`, and `?` is shorthand for
  `PRINT`. There is no `'` shorthand for `REM`; `^` is the power operator.
- Only the first two characters of a variable name are significant, so `COUNT`
  and `COST` are the same variable. `$` is the only type suffix — `%`, `!` and
  `#` are later additions, and `X%=1` is stored happily and then fails when it
  runs.
- Spaces are ignored outside strings, `REM` and `DATA`, so `FORI=1TO10` is
  valid. The other side of that rule is that a keyword is recognised inside a
  name: a variable called `TOTAL` contains `TO` and mis-runs without reporting
  an error.
- String space is 50 bytes until a program says `CLEAR n`. Assigning a literal
  (`A$="*"`) costs nothing; concatenating does.
- `PEEK`, `POKE`, `INP`, `OUT` and `WAIT` all take decimal addresses. There is
  no hexadecimal notation anywhere in this BASIC.

## What this machine does not have

The Altair predates almost everything a later Microsoft BASIC offers, and it is
easier to say what is absent than to notice it missing:

- **No `ELSE`** — write a second `IF`, or invert the test and jump.
- **No key-at-a-time read** — there is no `INKEY$` and no `GET`, so an
  interactive program takes one whole typed line per turn through `INPUT`.
  Polling the console with `INP` does not work around it: BASIC reads the same
  port looking for CTRL-C between every statement, and takes the character
  first.
- **No graphics, colour or sound** — the machine has no video hardware at all.
  Output is 7-bit ASCII down a serial line to a terminal, so `PRINT` is the
  whole repertoire: no `CLS`, no cursor addressing, and no display memory to
  write to. A picture is built in an array and printed a character at a time.
- **No file system** — `CSAVE` and `CLOAD` move the whole program to and from
  cassette, and that is all. There is no `OPEN`, no `PRINT#` and no directory.
- **No error trapping** — no `ON ERROR`, `ERR` or `RESUME`. An error stops the
  program and prints its two-letter code, so test a value before the operation
  that would fail.
- **No `PRINT USING`, `INSTR`, `STRING$` or `SPACE$`**, and `MID$` is a function
  only — unlike later Microsoft BASICs it cannot be assigned to.

## Supplying the interpreter

Altair 8K BASIC is Microsoft copyright with no redistribution grant, so no image
ships with this IDE and the machine cannot start without one. Everything on this
page describes the language; running it needs your own copy of the 8K BASIC 4.0
paper tape.

<ReferenceTable :data="altair8800Reference" />
