---
title: Acorn Atom BASIC reference
---

<script setup>
import { atomReference } from './data/atom';
</script>

# Acorn Atom BASIC reference

Every command, function and operator in Acorn Atom BASIC.

> **Data files.** `FIN`/`FOUT` open a file for input/output and `BGET`/`BPUT`
> read/write a byte; in this IDE they are served from the emulator's virtual
> filesystem (open the Emulator files viewer to inspect what a program wrote).
> On the emulated tape ROM there is no `SHUT`, so an output file is saved as each
> `BPUT` runs.
>
> **Not yet in this dialect.** Real Atom BASIC reaches memory through the
> indirection operators `?` (byte), `!` (4-byte word) and `$` (string) instead
> of `PEEK`/`POKE`, and offers the remainder operator `%` and the bitwise
> operators `&` (AND), `\` (OR) and `:` (XOR). It also has the functions/words
> `LEN`, `COUNT`, `PTR`, `EXT` and `SGET`/`SPUT`. These are not yet handled by
> this IDE's Atom dialect, so they are absent from the table below. (Atom BASIC
> has no `DIV` or `MOD` - those are BBC BASIC.)

<ReferenceTable :data="atomReference" />

## Machine code & data blocks

An Atom program can load fixed-address machine code or data — **memory blocks** —
into RAM alongside the BASIC program before it runs. A block may sit anywhere in
user RAM below the screen, from **0x2900 to 0x7FFF** (the MC6847 display sits
above it at #8000); new blocks default to **0x5000**, above a typical program.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-bproj) and through share links,
and can arrive on **import**: an `.atm` that loads somewhere other than `#2900`
(where BASIC text lives) is treated as a machine-code or data file, so its
payload comes in as a block at its load address.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](./6502-assembly).
