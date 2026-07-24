---
title: Locomotive BASIC reference
---

<script setup>
import { cpcReference } from './data/cpc';
</script>

# Locomotive BASIC reference

Every command, function and operator in Locomotive BASIC 1.0, the full-featured
BASIC of the Amstrad CPC 464 — with real structured keywords such as `IF … THEN
… ELSE`, `WHILE … WEND` and the `AFTER`/`EVERY` interrupt timers.

**In this reference:** [Hardware](./cpc/hardware) · [Escape codes](./cpc/escapes) · [File formats](./cpc/formats)

## Notes and caveats

- Line numbers 1–65535, strictly ascending; multiple statements per line with
  `:`. `?` is shorthand for `PRINT`, `'` for `REM`, and `LET` is optional.
- Variable names are up to 40 characters, all significant, with `$` (string),
  `%` (integer) and `!` (real) type suffixes.
- Numbers may be written in decimal, hex (`&7F00`) or binary (`&X1010`);
  operators include `^` (power), `\` (integer divide) and `MOD`.
- Read the keyboard in games with `INKEY(n)` — it returns `-1` while a key is
  up. The cursor keys are `INKEY(0)` up, `INKEY(2)` down, `INKEY(8)` left and
  `INKEY(1)` right. `JOY(0)` returns the joystick as a bit mask (bit 0 up, 1
  down, 2 left, 3 right, 4 fire 2, 5 fire 1).
- Entries tagged **BASIC 1.1 only** are the additions Locomotive BASIC 1.1 (the
  CPC 6128) brings; the BASIC 1.0 464 rejects them.

<ReferenceTable :data="cpcReference" />
