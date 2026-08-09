---
title: Acorn Atom hardware
---

<script setup>
import { atomMemoryMap } from '../../../src/dialects/atom/memoryMap';
</script>

# Acorn Atom hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Atom BASIC](../atom), and where machine-code and data blocks live in its
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

`MOVE <x>, <y>` positions the graphics cursor without drawing, `DRAW <x>, <y>` draws a
line from it (drawing to the cursor's own point plots a single dot), and
`PLOT <action>, <x>, <y>` plots with an action that controls whether the point is set,
cleared or inverted. The origin is the bottom-left of the screen.

### Sound

The Atom drives its internal loudspeaker by toggling a port bit at #B002. Real
Atom BASIC does this with the `?` indirection operator, which this dialect does
not yet implement (see the [notes on the reference page](../atom)), so there
are no sound commands here.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

The Atom is a small machine even by 1980 standards, and the map shows why: it
shipped with 2K of RAM and takes 12K at most without an off-board expansion.
That 12K is three separate runs — 1K of workspace at the bottom of memory, 5K
of internal RAM in the middle, and 6K of video RAM for the MC6847 — with
unfitted address space in between. BASIC gets the middle run: the
floating-point variables take its first page, leaving **0x2900 to 0x3BFF**,
4,864 bytes, for your program and its variables. The byte counter in the status
bar is measured against that.

<MemoryMapSingle machine="atom" :map="atomMemoryMap" />

An Atom program can load fixed-address machine code or data — **memory blocks** —
into RAM alongside the BASIC program before it runs. A block shares the BASIC
program's window, **0x2900 to 0x3BFF**; new blocks default to **0x3800**, in the
last 1K of it and so above a typical program. Nothing above 0x3BFF will do: that
address space is unfitted, and a write there is simply dropped.

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
