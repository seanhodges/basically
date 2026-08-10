---
title: Atom BASIC reference
---

<script setup>
import { atomReference } from '../../src/reference/atom';
</script>

# Atom BASIC reference

Every command, function and operator in Atom BASIC, the BASIC built into the
Acorn Atom.

**In this reference:** [Hardware](./atom/hardware) · [Escape codes](./atom/escapes) · [File formats](./atom/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- A keyword can be typed as a **dotted prefix** — `P.` for `PRINT`, `GOS.` for
  `GOSUB` — which the ROM expands to the first keyword the letters begin.
  Because the Atom stores program text as it is typed, an abbreviated keyword is
  genuinely fewer bytes. The shortest form of each is shown beside it in the
  table below, and the search box finds a keyword by it.
- **Data files.** `FIN`/`FOUT` open a file for input/output and `BGET`/`BPUT`
  read/write a byte, while `SGET`/`SPUT` transfer whole strings; in this IDE they
  are served from the emulator's virtual filesystem (open the Emulator files
  viewer to inspect what a program wrote). On the emulated tape ROM there is no
  `SHUT`, so an output file is saved as each `BPUT` runs.
- **Memory and bit operators.** Real Atom BASIC reaches memory through the
  indirection operators `?` (byte), `!` (4-byte word) and `$` (string) instead
  of `PEEK`/`POKE`, and offers the remainder operator `%` and the bitwise
  operators `&` (AND) and `:` (XOR). There is no `DIV` or `MOD` — those are BBC
  BASIC — and no symbolic spelling of bitwise OR: the `OR` keyword is itself
  bitwise, as `AND` is, so `5 AND 3` is `1` rather than a yes-or-no answer.
- **Two arithmetics.** `A`–`Z` are integers, where `/` truncates. The
  floating-point ROM's `%A`–`%Z` are reals, reached through `FPRINT`, `FIF` and
  the other `F` statements — and the power operator `^` belongs to that half
  only: `%A=2^3` works, while `2^3` in an integer expression is rejected. It is
  computed through logs, so `2^3` prints as `8.00000000` and `2^3^2` as
  `63.9999998`.
- **True is 1.** A comparison yields `1`, not the `-1` of the BBC BASIC that
  followed this machine, so an expression like `X=X+(A>B)` counts the other way
  after a port.

<ReferenceTable :data="atomReference" />
