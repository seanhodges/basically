---
title: Atom BASIC reference
---

<script setup>
import { atomReference } from './data/atom';
</script>

# Atom BASIC reference

Every command, function and operator in Atom BASIC, the BASIC built into the
Acorn Atom.

**In this reference:** [Hardware](./atom/hardware) · [Escape codes](./atom/escapes) · [File formats](./atom/formats)

## Notes and caveats

- **Data files.** `FIN`/`FOUT` open a file for input/output and `BGET`/`BPUT`
  read/write a byte; in this IDE they are served from the emulator's virtual
  filesystem (open the Emulator files viewer to inspect what a program wrote).
  On the emulated tape ROM there is no `SHUT`, so an output file is saved as
  each `BPUT` runs.
- **Not yet in this dialect.** Real Atom BASIC reaches memory through the
  indirection operators `?` (byte), `!` (4-byte word) and `$` (string) instead
  of `PEEK`/`POKE`, and offers the remainder operator `%` and the bitwise
  operators `&` (AND), `\` (OR) and `:` (XOR). It also has the functions/words
  `COUNT`, `PTR`, `EXT` and `SGET`/`SPUT`. These are not yet handled by this
  IDE's Atom dialect, so they are absent from the table below. (Atom BASIC has
  no `DIV` or `MOD` - those are BBC BASIC.)

<ReferenceTable :data="atomReference" />
