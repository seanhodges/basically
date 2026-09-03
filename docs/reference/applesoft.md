---
title: Applesoft BASIC reference
---

<script setup>
import { applesoftReference } from '../../src/reference/applesoft';
</script>

# Applesoft BASIC reference

Every command, function and operator in Applesoft BASIC — Microsoft's
floating-point BASIC as Apple shipped it, in the ROM sockets of the 1979 Apple II
Plus where the original machine had Woz's Integer BASIC.

**In this reference:** [Hardware](./applesoft/hardware) · [Escape codes](./applesoft/escapes) · [File formats](./applesoft/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- **No variable may contain a keyword, and `IF A THEN` is broken.** The
  interpreter scans its token table in token order and takes the first match,
  skipping spaces as it goes, so `AT` is found long before `ATN` or `THEN`.
  `LATCH=1` is stored as `L`, `AT`, `CH`, and `IF A THEN 20` as `IF`, `AT`,
  `HEN20`. Write conditions as comparisons — `IF A<>0 THEN 20` — and keep `AT`,
  `TO`, `THEN`, `NOT`, `AND`, `OR`, `STEP` and `FN` out of your names. The
  editor flags both.
- **Spaces are thrown away**, everywhere but inside a string, a `REM` body and a
  `DATA` statement. `10 PRINT   1` and `10 PRINT 1` are the same seven bytes,
  and because the scan steps over spaces too, `PR INT 1` prints and `FORI=1TO10`
  loops.
- Names may be as long as you like but **only the first two characters count**,
  so `COUNT` and `COST` are one variable. A `$` suffix makes a string and `%` a
  whole number from −32767 to 32767; everything else is floating point, nine
  significant digits and up to about ±1E38.
- **This is not Integer BASIC**, and the [Apple II](./integer-basic) next door is
  not this. One design with a different BASIC fitted: the two share more than a
  dozen spellings while agreeing about hardly any of them. Here `7/2` is 3.5.
- `AND`, `OR` and `NOT` reduce their operands to a truth value rather than
  combining bits: `5 AND 3` and `5 OR 3` are both `1`, and `NOT 5` is `0`. A true
  comparison is `1` — not the `-1` most Microsoft BASICs answer with.
- Multiple statements per line are allowed with `:`, and line numbers run 0 to 63999. A typed line keeps its first 239 characters and drops everything past
  them. Falling off the last line simply stops, so `END` is optional.
- There is **no hexadecimal notation** anywhere in this BASIC, so `PEEK`, `POKE`,
  `CALL` and `WAIT` take decimal — and anything above 32767 is written negative:
  `PEEK(-16384)` reads the keyboard.

<ReferenceTable :data="applesoftReference" />
