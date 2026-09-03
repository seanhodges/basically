---
title: MSX BASIC reference
---

<script setup>
import { msxReference } from '../../src/reference/msx';
</script>

# MSX BASIC reference

Every command, function and operator in **MSX BASIC 1.0**, the BASIC that came
in the ROM of every MSX1 — here, the Sony HB-10P.

MSX was a published standard rather than one company's machine, so this BASIC is
the same on every MSX1 whoever built it. It is Microsoft BASIC underneath, and
most of the table below will read as familiar; what is not Microsoft is the
machine bolted to it, and that is where the interesting keywords are.

**In this reference:** [Hardware](./msx/hardware) · [Escape codes](./msx/escapes) · [File formats](./msx/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- Line numbers 0–65529, strictly ascending, with several statements to a line
  separated by `:`. `?` is shorthand for `PRINT` and `'` for `REM`, and `LET` is
  optional. `GO TO` written as two words is **not** accepted, unlike the
  Microsoft BASICs this one descends from.
- Variable names may be long, but only the first two characters are
  significant, so `COUNT` and `COST` are one variable. All four type suffixes
  are real — `$` string, `%` integer, `!` single, `#` double — and a name
  carrying none is **double precision**, fourteen digits, unless `DEFINT` and
  its siblings say otherwise. Integer arithmetic is markedly faster, which is
  why `DEFINT A-Z` is the usual first line of a game.
- Spaces are ignored outside strings, `REM` and `DATA`, so `FORI=1TO10` is a
  loop. The other side of that rule is that a keyword is recognised inside a
  name: `SCORE` contains `OR` and `TOTAL` contains `TO`, and both are rejected.
- Numbers may be written in decimal, hex (`&HFF`), octal (`&O377`) or binary
  (`&B1010`). The operators include `^` (power, folding left to right so
  `2^3^2` is `64`), `\` (integer division), `MOD`, `XOR`, `EQV` and `IMP`.
  `AND`, `OR` and `NOT` combine their operands bit by bit, and a true
  comparison is `-1`.
- `<=`, `>=` and `<>` have no tokens of their own — each is stored as its two
  characters' tokens side by side — which is why `=<`, `=>` and `><` are the
  same three tests written the other way round, and why all six are listed
  below.
- The string space is **200 bytes** on a clean boot, whatever the free-memory
  figure says. A program holding more than a handful of strings needs a
  `CLEAR 1500` (or larger) first, or it stops with `Out of string space`.
- There is no `WHILE`/`WEND`. And `CALL` is for cartridge extensions, not for
  machine code: a code block is reached with `DEF USR` and `USR`.

## What this machine does not run

The disc vocabulary is in the ROM of a machine that never had a drive. `FILES`,
`LFILES`, `KILL`, `NAME`, `COPY`, `SET`, `IPL`, `CMD`, `DSKI$`, `DSKO$`,
`DSKF`, `ATTR$`, `FPOS`, `LOC` and `LOF` all tokenize and all answer `Illegal
function call`; `FIELD`, `GET`, `PUT #`, `LSET` and `RSET` want a disc for the
same reason. They are in the table because the machine has them, not because
they work.

<ReferenceTable :data="msxReference" />
