---
title: Acorn Atom hardware
---

# Acorn Atom hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Acorn Atom BASIC](../atom), and where machine-code and data blocks live in its
memory.

## Acorn Atom

### Screen modes

The Atom's MC6847 video chip is driven with `CLEAR`, which selects a mode and
clears it: `CLEAR 0` is the 32×16 text screen, while `CLEAR 1`–`4` select
graphics modes of increasing resolution, up to 256×192 in `CLEAR 4`.

### Colour

The Atom's BASIC modes are monochrome — `PLOT`'s modes set, clear or invert a
point rather than choosing a colour (the Atom has no colour list like the BBC).

### Graphics

`MOVE x,y` positions the graphics cursor without drawing, `DRAW x,y` draws a
line from it (drawing to the cursor's own point plots a single dot), and
`PLOT mode,x,y` plots with a mode that controls whether the point is set,
cleared or inverted. The origin is the bottom-left of the screen.

### Sound

The Atom drives its internal loudspeaker by toggling a port bit at #B002. Real
Atom BASIC does this with the `?` indirection operator, which this dialect does
not yet implement (see the [notes on the reference page](../atom)), so there
are no sound commands here.

### Memory

An Atom program can load fixed-address machine code or data — **memory blocks** —
into RAM alongside the BASIC program before it runs. A block may sit anywhere in
user RAM below the screen, from **0x2900 to 0x7FFF** (the MC6847 display sits
above it at #8000); new blocks default to **0x5000**, above a typical program.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links,
and can arrive on **import**: an `.atm` that loads somewhere other than `#2900`
(where BASIC text lives) is treated as a machine-code or data file, so its
payload comes in as a block at its load address.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
