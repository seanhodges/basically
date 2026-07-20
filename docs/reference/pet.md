---
title: Commodore PET BASIC 4.0 reference
---

<script setup>
import { petReference } from './data/pet';
</script>

# Commodore PET BASIC 4.0 reference

Every command, function and operator in Commodore BASIC 4.0, the BASIC built into
the Commodore PET's ROM. It is the same core language as the [Commodore
64's](./commodore64) BASIC V2, extended with fifteen disk-handling commands
(tagged **BASIC 4.0** below). The PET shares the C64's PETSCII character set, so
the same [escape codes](./commodore64/escapes) apply — though the colour-control
codes have no effect on the PET's monochrome display.

<ReferenceTable :data="petReference" />

## Machine code & data blocks

A PET program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program before it runs. On the PET a block
may sit from **0x0400 to 0x7FFF** (BASIC text itself starts at $0401); new blocks
default to **0x7000**, high in RAM clear of a typical program.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-bproj) and through share links.
They can also arrive on **import**, using the same `.prg` rule as the
[C64 and VIC-20](./commodore64#machine-code-data-blocks): a `.prg` whose load
address isn't the BASIC start ($0401) comes in as a block at that address, and a
normal `.prg` with bytes past the end of the tokenized program brings those
trailing bytes in as a block.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](./6502-assembly).
