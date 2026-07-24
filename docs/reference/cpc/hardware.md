---
title: Amstrad CPC hardware
---

# Amstrad CPC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Locomotive BASIC](../cpc), and where machine-code and data blocks
live in its memory.

## Amstrad CPC 464

### Screen modes

Pick a mode with `MODE`:

| Mode     | Text       | Graphics  | Inks |
| -------- | ---------- | --------- | ---- |
| `MODE 0` | 20 columns | 160 × 200 | 16   |
| `MODE 1` | 40 columns | 320 × 200 | 4    |
| `MODE 2` | 80 columns | 640 × 200 | 2    |

All three render into one display; graphics always use a 640 × 400 coordinate
space with the origin at the bottom-left, moved with `ORIGIN`.

### Colour

The CPC has **27 hardware colours** (0–26). `INK p,c` assigns colour `c` to pen
`p`; a second argument (`INK p,c1,c2`) flashes between two colours. `PEN` selects
the text ink, `PAPER` the text background and `BORDER` the surround.

### Graphics

`PLOT x,y[,pen]` lights a point, `DRAW x,y[,pen]` draws a line from the last
position, and `MOVE`/`DRAWR`/`MOVER` reposition or draw relatively. In BASIC 1.0
the plotting ink is the optional third argument to `PLOT`/`DRAW` (the `GRAPHICS
PEN`/`GRAPHICS PAPER` statements are BASIC 1.1 only and are not available on the
464).

### Sound

`SOUND channel,period,duration[,volume[,volenv[,toneenv[,noise]]]]` plays a tone;
`period` is `62500 / frequency`. `ENV` and `ENT` define volume and tone
envelopes.

### Memory

A CPC program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program and are in place before it runs.
The CPC is a flat 64K of RAM (the firmware and BASIC ROMs are read overlays
only), so a block may sit almost anywhere from **&0040 to &FFFF**; new blocks
default to **&8000**, below the default `HIMEM` (&AB7F) and clear of a typical
program. Reserve room on real hardware with `MEMORY &7FFF` before loading code
that high.

Three regions are flagged with a warning rather than refused: the firmware and
BASIC workspace below the program (**&0040–&016F**), the high BASIC workspace and
firmware jumpblocks above HIMEM (**&AB80–&BFFF**), and the screen memory
(**&C000–&FFFF**). A block there loads, but the running machine may overwrite it.
`CALL address` runs a block from BASIC.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links. On
Run the IDE refuses to start if a block would overlap the BASIC program, and
warns (but allows) a block over reserved workspace or the screen. See the
[machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).
