---
title: SAM BASIC reference
---

<script setup>
import { samcoupeReference } from '../../src/reference/samcoupe';
</script>

# SAM BASIC reference

Every command, function and operator in **SAM BASIC**, the BASIC in the SAM
Coupé's v3.0 ROM.

It looks Sinclair-ish and is not. SAM BASIC is Andy Wright's Beta BASIC line: a
structured BASIC with `DO … LOOP`, block `IF`, named procedures and labels, and
its own token table, line format and line-number ceiling. A ZX Spectrum program
has to be run through MGT's own `BTRANS` utility to become a SAM one — the
compatibility between the two machines is at the hardware level, not this one.

**In this reference:** [Hardware](./samcoupe/hardware) · [Escape codes](./samcoupe/escapes) · [File formats](./samcoupe/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- Line numbers 1–65279, strictly ascending, with several statements to a line
  separated by `:`. One line holds at most 16127 stored bytes; a longer one is
  `No room for line`. There is no `?` shorthand for `PRINT`.
- **`LET` is not optional.** A bare `A=1` opens a call to a procedure named `A`,
  because writing a procedure's name is how one is called — so every assignment
  needs its `LET`. This is the single difference that catches out a program
  arriving from anywhere else.
- Variable names run to 32 characters for a number and 10 for a string or an
  array (not counting the `$` or the bracket), and every character is
  significant: a name over the limit is rejected rather than shortened. `_` is a
  name character, spaces inside a name are ignored and letters fold to lower
  case, so `hi score` and `hiscore` are one variable. `$` is the only type
  marker — there is no integer type.
- Keywords match as whole words, so `PRINTER` is a variable and not `PRINT`
  followed by `ER`. A name may be spelled around a keyword; it may not equal one.
- Numbers may be written in hex with `&` (`&FE00`), and `BIN 10110` reads a run
  of binary digits. The operators include `↑` (power, typed with the caret key),
  `MOD` and `DIV` for the two halves of integer division, and `BOR` and `BAND`
  for the bitwise operations `OR` and `AND` deliberately do not do.
- The structured keywords are what make a listing read as SAM rather than
  Spectrum, and are the idiomatic way to write here: `DO`/`LOOP` with `WHILE` or
  `UNTIL` on either end, `EXIT IF`, block `IF` with `ELSE` and `END IF`,
  `DEF PROC`/`END PROC` called by writing the name, and `LABEL` for a named jump
  target that survives `RENUM`.
- A group of keywords is in the ROM's token table but not in the ROM. `DIR`,
  `ERASE`, `FORMAT`, `MOVE`, `COPY`, `RENAME`, `PROTECT`, `HIDE`, `REF`, `USING`
  and `WRITE` all tokenize and are then refused as `Not understood`, because the
  parser that would read them arrives with a disc operating system. `EOF`,
  `PTR`, `PATH$`, `DVAR` and the file form of `OPEN` get as far as running and
  answer `No DOS` instead. They are listed because the machine has them, not
  because they work here.
- `LPRINT`, `LLIST` and `DUMP` want a printer, and the mouse and light-pen
  readings (`XMOUSE`, `YMOUSE`, `XPEN`, `YPEN`, `BUTTON`) want hardware that is
  not fitted. None of them is an error; they simply do nothing.

<ReferenceTable :data="samcoupeReference" />
