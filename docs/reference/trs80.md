---
title: TRS-80 Level II BASIC reference
---

<script setup>
import { trs80Reference } from '../../src/reference/trs80';
</script>

# TRS-80 Level II BASIC reference

Every command, function and operator in TRS-80 Level II BASIC.

**In this reference:** [Hardware](./trs80/hardware) · [Escape codes](./trs80/escapes) · [File formats](./trs80/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- Multiple statements per line are allowed with `:`; `?` is shorthand for
  `PRINT` and `'` for `REM`.
- Variable names may be any length but only the first two characters are
  significant, with `$` (string), `%` (integer), `!` (single) and `#` (double)
  type suffixes; `DEFSTR`/`DEFINT`/`DEFSNG`/`DEFDBL` set the default type per
  initial letter.
- `PRINT @ n,` moves the cursor to one of the 1024
  [screen cells](./trs80/hardware) before printing, and `PRINT USING` formats
  values against a template. The E-notation marker in a `USING` template is four
  carets (`^^^^`): the up-arrow the manuals draw is the power operator, and the
  machine has no character for it to store inside a string.

## What this machine does not run

The TRS-80 runs on a BASIC interpreter rather than an emulated CPU, a few
keywords are accepted but not currently supported in the emulator:

- **Error trapping** — `ON ERROR GOTO`, `RESUME` and `ERROR` do not take effect,
  and `ERL`/`ERR` read as zero. A runtime error stops the program and is
  reported in the IDE instead.
- **Machine-level access** — `USR` and `VARPTR` have no address space to work
  with, and `INP`/`OUT` have no ports; `MEM` and `FRE` report fixed figures, as
  there is no real memory allocator to ask.
- **Peripherals** — `LPRINT` and `LLIST` are accepted and discarded (there is no
  printer), and `TIME$` is empty.
- **Random-access disk files** — `FIELD`, `GET`, `PUT`, `LSET` and `RSET` are
  accepted and ignored. Sequential files (`OPEN`, `PRINT#`, `INPUT#`,
  `LINE INPUT#`, `CLOSE`, `KILL`, `EOF`, `LOC`, `LOF`) work against the
  project's files.
- **Editing and listing commands** — `LIST`, `EDIT`, `AUTO`, `DELETE`, `NEW`,
  `CONT`, `TRON` and `TROFF` belong to the machine's own prompt; use the IDE's
  editor and debugger instead.

<ReferenceTable :data="trs80Reference" />
