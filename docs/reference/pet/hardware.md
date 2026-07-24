---
title: Commodore PET hardware
---

# Commodore PET hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Commodore PET BASIC 4.0](../pet), and where machine-code and data blocks live
in its memory.

## Commodore PET

### Screen modes

The PET has a single 40×25 character screen on its built-in monochrome
monitor. The 1000-byte screen memory at 32768 ($8000) can be read and written
directly with `PEEK` and `POKE`.

### Colour

The PET has no colour hardware — the display is monochrome green on black. The
PETSCII colour-control escapes shared with the C64 store and round-trip
identically but have no visible effect (see the
[escape codes](../commodore64/escapes) page).

### Graphics

Graphics are drawn with the PETSCII block-graphics characters — printed, or
POKEd straight into screen memory. There is no bitmap mode.

### Sound

The PET shipped without dedicated sound hardware (later models could drive a
small piezo speaker from the CB2 line), and BASIC 4.0 has no sound keywords.

### Memory

A PET program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program before it runs. On the PET a block
may sit from **0x0400 to 0x7FFF** (BASIC text itself starts at $0401); new blocks
default to **0x7000**, high in RAM clear of a typical program.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links.
They can also arrive on **import**, using the same `.prg` rule as the
[C64 and VIC-20](../commodore64/hardware#memory): a `.prg` whose load
address isn't the BASIC start ($0401) comes in as a block at that address, and a
normal `.prg` with bytes past the end of the tokenized program brings those
trailing bytes in as a block.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
