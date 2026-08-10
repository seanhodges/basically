---
title: Locomotive BASIC reference
---

<script setup>
import { cpcReference } from '../../src/reference/cpc';
</script>

# Locomotive BASIC reference

Every command, function and operator in Locomotive BASIC, the full-featured BASIC
of the Amstrad CPC — with real structured keywords such as `IF … THEN … ELSE`,
`WHILE … WEND` and the `AFTER`/`EVERY` interrupt timers.

Two machines run it here: the **CPC 464** with BASIC 1.0, and the **CPC 6128**
with BASIC 1.1, which adds eleven keywords to the same language.

**In this reference:** [Hardware](./cpc/hardware) · [Escape codes](./cpc/escapes) · [File formats](./cpc/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- `'` opens a comment as `REM` does, and is shown beside it in the table below;
  the search box finds the keyword by it.
- Line numbers 1–65535, strictly ascending; multiple statements per line with
  `:`. `?` is shorthand for `PRINT`, `'` for `REM`, and `LET` is optional.
- Variable names are up to 40 characters, all significant, with `$` (string),
  `%` (integer) and `!` (real) type suffixes.
- Numbers may be written in decimal, hex (`&7F00`) or binary (`&X1010`);
  operators include `^` (power, folding left to right so `2^3^2` is `64`), `\`
  (integer divide), `MOD` and `XOR`. `AND`, `OR` and `NOT` are bitwise, and a
  true comparison is `-1`.
- Read the keyboard in games with `INKEY(n)` — it returns `-1` while a key is
  up. The cursor keys are `INKEY(0)` up, `INKEY(2)` down, `INKEY(8)` left and
  `INKEY(1)` right. `JOY(0)` returns the joystick as a bit mask (bit 0 up, 1
  down, 2 left, 3 right, 4 fire 2, 5 fire 1).
- Entries tagged **BASIC 1.1 only** are the additions Locomotive BASIC 1.1 (the
  CPC 6128) brings; the BASIC 1.0 464 rejects them. Everything untagged works on
  both machines and produces the same program either way, so a listing that
  avoids the tagged entries moves between them unchanged.

<ReferenceTable :data="cpcReference" />
