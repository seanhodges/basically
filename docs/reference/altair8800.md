---
title: Altair 8K BASIC reference
---

<script setup>
import { altair8800Reference } from '../../src/reference/altair8800';
</script>

# Altair 8K BASIC reference

Every command, function and operator in Altair 8K BASIC — the 1975–76 MITS
interpreter that every later Microsoft BASIC descends from.

**In this reference:** [Hardware](./altair8800/hardware) · [Escape codes](./altair8800/escapes) · [File formats](./altair8800/formats) · [Argument notation](./#argument-notation)

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

## Supplying the interpreter

Altair 8K BASIC is Microsoft copyright with no redistribution grant, no ROM
ships with this IDE and the emulator cannot start without one. You can upload
a ROM in the settings page.

<ReferenceTable :data="altair8800Reference" />
