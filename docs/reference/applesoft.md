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

- **This is not Integer BASIC**, and the [Apple II](./integer-basic) next door is not
  this. The two machines are one design with a different BASIC fitted, and they
  share more than a dozen spellings while agreeing about hardly any of them.
  Here there is floating point, so `7/2` is 3.5; `RND(1)` is a fraction below 1
  rather than a whole number; `ASC("H")` is 72 rather than 200; strings join with
  `+` and slice with `LEFT$`, `RIGHT$` and `MID$`; and `HGR`, `HPLOT` and the
  shape table put hi-res graphics in the language.
- **No variable may contain a keyword, and `IF A THEN` is broken.** The
  interpreter scans its token table in token order and takes the first match, so
  `AT` is found long before `ATN` or `THEN` — and it skips spaces while matching.
  `LATCH=1` is stored as `L`, `AT`, `CH`; `CATALOG` as `C`, `AT`, `A`, `LOG`; and
  `IF A THEN 20` as `IF`, `AT`, `HEN20`. Write conditions as comparisons —
  `IF A<>0 THEN 20` — and keep `AT`, `TO`, `THEN`, `NOT`, `AND`, `OR`, `STEP`,
  `FN` and the rest out of your names. The editor flags both.
- **Spaces are thrown away**, everywhere but inside a string, a `REM` body and a
  `DATA` statement. `10 PRINT   1` and `10 PRINT 1` are the same seven bytes, and
  because the scan steps over spaces too, `PR INT 1` prints and `FORI=1TO10`
  loops. `LIST` puts its own spacing back around every token, having none of the
  original left to restore — which is why a listed program never looks quite like
  the one that was typed.
- Names may be as long as you like but **only the first two characters count**,
  so `COUNT` and `COST` are one variable. A name ending in `$` is a string and one
  ending in `%` is a whole number from −32767 to 32767; everything else is
  floating point, nine significant digits and up to about ±1E38.
- A string holds at most 255 characters and is built by joining with `+`; a join
  past 255 is `?STRING TOO LONG ERROR`. There is no assigning into the middle of
  one — rebuild it from the parts on either side.
- Arrays take any number of dimensions and either type, and subscripts count from 0. `DIM` is needed only past ten: an array used without one is created with
  subscripts 0 to 10.
- `AND`, `OR` and `NOT` reduce their operands to a truth value rather than
  combining bits: `5 AND 3` and `5 OR 3` are both `1`, and `NOT 5` is `0`. A true
  comparison is `1` — not the `-1` most Microsoft BASICs answer with.
- `<=`, `>=` and `<>` are stored as their two single-character tokens in the order
  they were typed, so `A<>B` lists back as `A < > B`, and `=<`, `=>` and `><`
  parse as the same three tests.
- `GOSUB` nests twenty-four deep. The twenty-fifth answers `?OUT OF MEMORY ERROR`,
  the processor stack rather than the workspace being what runs out.
- An error stops the program and reports `?SYNTAX ERROR IN 10` — a `?` prefix, the
  message, ` ERROR`, and the line. `STOP` reports `BREAK IN 10` instead.
  `ONERR GOTO` traps the lot; the code of the error that fired is in location 222
  and its line in 218 and 219, and `RESUME` goes back to the statement that
  raised it.
- Multiple statements per line are allowed with `:`, and line numbers run 0 to 63999. A typed line keeps its first 239 characters and drops everything past
  them. Falling off the last line simply stops, so `END` is optional.
- Upper case only: the character generator has no lower-case shapes, and a
  lower-case letter folds to its capital.
- `?` is `PRINT`, and it is the whole of this machine's abbreviation scheme —
  there is no dotted prefix and no shifted letter. The Apple II next door does not
  even have this.
- `PEEK`, `POKE`, `CALL` and `WAIT` take decimal addresses and there is no
  hexadecimal notation anywhere in this BASIC, so anything above 32767 is written
  negative: `PEEK(-16384)` reads the keyboard.

<ReferenceTable :data="applesoftReference" />
