---
title: Microsoft BASIC reference
---

<script setup>
import { altair8800Reference } from '../../src/reference/altair8800';
</script>

# Microsoft BASIC reference

Every command, function and operator in **Altair 8K BASIC**, the version of
Microsoft BASIC the MITS Altair 8800 runs — the 1975–76 interpreter that every
later Microsoft BASIC descends from.

**In this reference:** [Hardware](./altair8800/hardware) · [Escape codes](./altair8800/escapes) · [File formats](./altair8800/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- `?` stands for `PRINT`, and is shown beside it in the table below; the search
  box finds the keyword by it.
- Multiple statements per line are allowed with `:`, and `?` is shorthand for
  `PRINT`. There is no `'` shorthand for `REM`.
- `^` is the power operator — there is no up-arrow spelling — and it folds left
  to right, so `2^3^2` is `64`. `AND`, `OR` and `NOT` combine their operands bit
  by bit, and a true comparison is `-1`. There is no integer-division, remainder
  or exclusive-OR operator: use `INT(a/b)` and `a-b*INT(a/b)`.
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

## The interpreter

The Altair had no firmware. BASIC arrived on a paper tape you loaded into RAM
at address 0 before anything else could happen, so what the IDE calls this
machine's ROM is really that tape: Altair 8K BASIC 4.0, 8 KB of it, copied to
address 0 at reset. It runs from RAM, which is why a wrong `POKE` can corrupt
the interpreter itself.

The image is bundled, and starts automatically — the cold-start dialogue
(`MEMORY SIZE?`, `TERMINAL WIDTH?`, `WANT SIN-COS-TAN-ATN?`) is answered for
you with 48 KB, 72 columns and the transcendental functions kept. You can
install a different Altair BASIC in the settings page; the addresses in this
reference were read off the 4.0 eight-K tape and are not promised of another.

<ReferenceTable :data="altair8800Reference" />
