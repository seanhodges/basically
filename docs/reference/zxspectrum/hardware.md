---
title: ZX Spectrum hardware
---

<script setup>
import { spectrumMemoryMap } from '../../../src/dialects/zxspectrum/memoryMap';
import { spectrum128MemoryMap } from '../../../src/dialects/zxspectrum128/memoryMap';
</script>

# ZX Spectrum hardware

The screen, colour, graphics and sound hardware of each machine that runs
[ZX Spectrum BASIC](../zxspectrum), and where machine-code and data blocks live
in its memory.

## ZX Spectrum 48K

### Screen modes

The Spectrum has a single display mode: a 256×192 pixel bitmap overlaid by a
32×24 grid of colour attribute cells. The top 22 character rows hold program
output; the bottom two lines are reserved for input and reports.

### Colour

Eight colours (0 black to 7 white) are available for `INK` (foreground),
`PAPER` (background) and `BORDER`, with two per-cell modifiers: `BRIGHT` for
high intensity and `FLASH` to alternate ink and paper. Colour is stored one
ink/paper pair per 8×8 attribute cell, so two differently-coloured shapes in
the same cell clash — the classic Spectrum attribute clash. `ATTR` reads a
cell's attribute byte back; `INVERSE` and `OVER` modify how following output is
drawn.

### Graphics

`PLOT <x>, <y>` sets a pixel — x runs 0–255 and y 0–175 from the bottom-left.
`DRAW <dx>, <dy>` draws a line by a relative offset — unlike most machines here,
which draw to an absolute point — and a third argument bends it into an arc.
`CIRCLE <x>, <y>` takes an absolute centre and a radius, and the `POINT` function
tests whether a pixel is set.

### Sound

`BEEP <duration>, <pitch>` plays a tone through the internal beeper — the duration
in seconds and the pitch in semitones above or below middle C.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="zxspectrum" :map="spectrumMemoryMap" />

A ZX Spectrum program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program and are in place before
it runs. A block may sit anywhere in the RAM above the ROM, from **0x4000 to
0xFFFF**; new blocks default to **0x8000**, clear of a typical program and its
variables. This holds for both the 48K and 128K models.

Two regions are flagged with a warning rather than refused: the display file and
colour attributes at **0x4000–0x5AFF**, and the system-variable area just above
it. A block there loads, but the running machine may overwrite it.

When a block sits below the default RAMTOP, the IDE runs a `CLEAR` for the byte
just below the block before it starts the program, so the BASIC stack can't grow
up over your code — poke a routine at 32768 and the IDE issues `CLEAR 32767`
first.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links.
They can also arrive on **import**: a `.TAP` containing CODE files brings each
CODE file in as a block. A tape that uses a tiny loader to chain into a larger
program is recognised — the loader is skipped (with a note) and the real program
imported. On Run the IDE refuses to start if a block would overlap the BASIC
program, and warns (but allows) a block over reserved hardware.

For a worked example, poke the five bytes `3E 02 D3 FE C9` (`LD A,2 : OUT
(0xFE),A : RET`) at 32768 and add `10 RANDOMIZE USR 32768`: running it turns the
border red. See the [machine code guide](../../guide/machine-code) for the full
how-to and [Machine code & data blocks](../file-formats#machine-code-data-blocks)
for the cross-dialect overview. Every mnemonic, directive and operand form the
assembly editor accepts is in the [Z80 assembly reference](../z80-assembly).

## ZX Spectrum 128K

### Screen modes

The display hardware is the 48K's: the same single 256×192 bitmap mode with
32×24 attribute cells.

### Colour

Identical to the 48K — the same eight colours, `BRIGHT`, `FLASH` and per-cell
attributes.

### Graphics

Identical to the 48K — the same `PLOT`/`DRAW`/`CIRCLE` commands and coordinate
space.

### Sound

Alongside the 48K beeper and `BEEP`, the 128K models add an AY-3-8912
three-channel sound chip, driven from BASIC with `PLAY` — one music string per
channel. Keywords tagged **128K only** in the
[reference table](../zxspectrum), such as `PLAY`, need 128 BASIC mode.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="zxspectrum128" :map="spectrum128MemoryMap" />

Block placement is identical to the 48K: the same **0x4000–0xFFFF** window,
default address, warnings and `CLEAR` handling described
[above](#memory) apply to the 128K models.
