---
title: Commodore 64 & VIC-20 BASIC reference
---

<script setup>
import { commodore64Reference } from './data/commodore64';
</script>

# Commodore 64 & VIC-20 BASIC reference

Every command, function and operator in Commodore BASIC V2, the BASIC built into
the ROMs of both the Commodore 64 and the VIC-20. BASIC V2 is
token-identical across the two machines — same ROM tokens, same `LIST`
spellings — so this one page is the reference for both; only the machine
hardware (screen size, colours, sound, memory map) differs. The
[Commodore PET](./pet) runs the same core language plus fifteen extra disk
commands, listed on its own page.

The [PETSCII escape codes](./commodore64/escapes) sub-page covers all three
machines.

<ReferenceTable :data="commodore64Reference" />

## Machine code & data blocks

A Commodore program can load fixed-address machine code or data — **memory
blocks** — into RAM alongside the BASIC program, ready before it runs. Where a
block may live depends on the machine:

- **Commodore 64** — anywhere from **0x0800 to 0xFFFF** (BASIC itself starts at
  $0801); new blocks default to **0xC000**. The I/O area at **0xD000–0xDFFF** is
  flagged with a warning — a block there loads but sits under the VIC-II, SID and
  colour registers.
- **VIC-20** (unexpanded) — from **0x1000 to 0x1DFF**, with BASIC starting at
  $1001; new blocks default to **0x1C00**. The screen at **0x1E00–0x1FFF** is
  reserved with a warning. RAM expansions aren't modelled, so the usable window
  is the bare 5K machine's.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-bproj) and through share links,
and can arrive on **import**: a `.prg` whose load address isn't the BASIC start
comes in as a single block at that address, and a normal `.prg` with extra bytes
past the end of the tokenized program brings those trailing bytes in as a block.

On Run the IDE refuses to start if a block would overlap the BASIC program, and
warns (but allows) a block over reserved hardware.

For a worked example on the C64, poke `A9 02 8D 20 D0 60` (`LDA #2 : STA $D020 :
RTS`) at 49152 and add `10 SYS 49152`: running it turns the border red. See the
[machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](./6502-assembly).
