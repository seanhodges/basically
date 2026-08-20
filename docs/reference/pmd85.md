---
title: BASIC-G reference
---

<script setup>
import { pmd85Reference } from '../../src/reference/pmd85';
</script>

# BASIC-G reference

Every command, function and operator in BASIC-G — the graphics BASIC Tesla
shipped in the PMD 85-2's plug-in ROM module.

**In this reference:** [Hardware](./pmd85/hardware) · [Escape codes](./pmd85/escapes) · [File formats](./pmd85/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- BASIC-G is a Microsoft 8K BASIC derivative, so most of the vocabulary below
  will look familiar. Four differences will not:
  - the user-defined-function keyword is **`FNC`**, and the name is a separate
    word: `DEF FNC A(X)=X*2` is called as `FNC A(3)`;
  - **`?` is not `PRINT`.** It stores the token whose spelling is `_`, which
    prints into the dialogue line and then waits for a key — so a `?` typed in
    lists back as `_`;
  - a hexadecimal literal is written with a leading apostrophe, as `'FF`;
  - line numbers stop at 32767, not 65529.
- Multiple statements per line are allowed with `:`. Spaces are ignored outside
  strings, `REM` and `DATA`, so `FORI=1TO10` is valid — and the other side of
  that rule is that a keyword is recognised inside a name, so a variable called
  `MYVAL` contains `VAL` and is rejected as a syntax error.
- Only the first two characters of a variable name are significant, so `ABCD`
  and `ABZZ` are one variable — but **case matters**: `A` and `a` are two, which
  no other Microsoft BASIC in this IDE does. `$` is the only type suffix.
- `^` is the power operator and it folds left to right, so `2^3^2` is `64`.
  `AND`, `OR` and `NOT` combine their operands bit by bit, and a true comparison
  is `-1`.
- `USR(addr)` calls the address itself rather than a vector poked in beforehand,
  which is where BASIC-G parts company with the Microsoft BASICs it descends
  from.
- The tape commands take a file **number**, not a name: `SAVE 1`, and `SAVE "A"`
  answers with a type error.
- `INKEY` reads only the twelve function keys `K0`–`K11`, reporting 255 when
  none is held. Anything else has to come through `INPUT`, a line at a time.

<ReferenceTable :data="pmd85Reference" />
