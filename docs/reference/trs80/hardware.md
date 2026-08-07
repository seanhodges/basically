---
title: TRS-80 hardware
---

# TRS-80 hardware

The screen, colour, graphics and sound hardware of each machine that runs
[TRS-80 Level II BASIC](../trs80), and where machine-code and data blocks live
in its memory.

## TRS-80 Model I

### Screen modes

The Model I has a single 64×16 character screen. `PRINT @ <cell>,` positions output
at any of the 1024 screen cells (0–1023), and `CLS` clears the whole screen and
homes the cursor to cell 0.

### Colour

The TRS-80 has no colour hardware — the display is monochrome.

### Graphics

Block graphics divide each character cell into a 2×3 group, giving a 128×48
grid: `SET(<x>, <y>)` lights a block, `RESET(<x>, <y>)` clears it and the `POINT(<x>, <y>)`
function tests one — the classic tools for game screens and collision
detection. The same sextant patterns can be printed directly as characters
(see the [escape codes](./escapes) page).

### Sound

The Model I has no sound hardware — games that made sound pulsed the cassette
output port (`OUT 255, <byte>`) into an external amplifier.

### Memory

A TRS-80 program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. On the
TRS-80 a block may sit from **0x4000 to 0x7FFF**; new blocks default to
**0x7000**, high in RAM clear of a typical program.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links,
and can arrive on **import**: a machine-language SYSTEM-format `.cas` brings each
of its address records in as a block. An ordinary BASIC `.cas` is unaffected.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).
