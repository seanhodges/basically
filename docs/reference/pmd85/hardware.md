---
title: PMD 85 hardware
---

<script setup>
import { pmd85MemoryMap } from '../../../src/dialects/pmd85/memoryMap';
</script>

# PMD 85 hardware

The screen, colour, graphics and sound hardware of each machine that runs
[BASIC-G](../pmd85), and where machine-code and data blocks live in its memory.

## Tesla PMD 85-2

### Screen modes

One mode, always. The video circuit reads a 16K frame buffer and paints 288×256
monochrome pixels; there is no text mode underneath it, and no way to change the
resolution.

The geometry is not the one a 256×192 machine would lead you to expect. A
scanline is 64 bytes apart from the next, of which only the first 48 reach the
screen, and only the low **six** bits of each byte are pixels — 48 × 6 = 288.
The 16 bytes the video circuit never fetches are ordinary RAM, and the firmware
keeps its own variables in the tails of the first eight lines.

Text is the firmware's doing rather than the hardware's: it draws 48 characters
across and 26 rows down, each glyph eight pixel rows tall on a nine-scanline
pitch, and keeps a separate one-line **dialogue line** at the very foot of the
screen. That line is where what you type appears, where `DISP` prints, and where
error messages arrive; the 26 rows above it scroll independently of it.

### Colour

None: the display is monochrome. The top two bits of each byte are that
six-pixel cell's attribute, and they are two independent flags rather than a
colour:

| Bit | Effect                                       |
| --- | -------------------------------------------- |
| 6   | The cell blinks between its pixels and black |
| 7   | The cell is drawn at half brightness         |

`PEN n` writes the pair for the drawing statements and `PRINT INK(n);` for the
text that follows it, so `0` is plain, `1` blinking, `2` dim and `3` both. A
clear pixel bit is background whatever the attribute says.

The PMD 85-3 reuses the same two bits as an RGB colour select and loses the
blink; that machine is not modelled here.

### Graphics

Drawn rather than typed — which is the "G" in BASIC-G, and the sharpest break
from the Microsoft BASICs it otherwise resembles. `SCALE` sets a coordinate
window, `MOVE` and `PLOT` draw lines inside it, `AXES` draws a pair of axes with
tick marks, `LABEL` plots text at the drawing scale, and `FILL` plots a byte as
an enlarged bit pattern. `BMOVE` and `BPLOT` go under all of that and write
bytes straight into the frame buffer, six pixels at a time, which is how a
sprite is drawn.

There are no graphics characters at all. The character generator holds printable
ASCII plus one solid cell, so a mosaic set of the kind a Sinclair or a Commodore
has simply does not exist here — the [escape codes](./escapes) page has the
whole of it.

### Sound

`BEEP`, and nothing else: a single fixed tone on the speaker hanging off the
motherboard's MHB8255A, with no pitch, length or channel to give it. A tune has
to be driven by `OUT` to the speaker bit and timed by the program.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="pmd85" :map="pmd85MemoryMap" />

Two things about this layout are unusual enough to be worth stating outright.

**BASIC-G is not firmware.** The interpreter lives in a replaceable ROM module
the CPU cannot address at all: the Monitor reads it a byte at a time through a
parallel-interface chip and copies it down to address 0 before anything runs. So
the whole interpreter is in writable RAM, and a stray `POKE` really can take it
down — there is no read-only memory below `'8000` and nothing in the hardware to
say no.

**String space is not at the top of memory.** Most Microsoft BASICs put the
string pool above the arrays and let the two grow towards each other. BASIC-G
gives strings a region of their own above its workspace, which is why the
program area has a hard ceiling: program text, variables and arrays share the
run from `'2401` up to the stack at `'5DFF`, and that is the 14846 bytes the
IDE reports free.

A PMD 85 program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A
block may sit in the program area itself, from `'2401` to `'5DFF`, or in the
free RAM above the string pool, from `'6F00` to `'7EFF`; new blocks default to
`'7000`, which is where the machine's own `ROM n` statement copies a module
block and calls it. Everything else in the bottom 32K belongs to something that
is live while a program runs, so a block reaching it is rejected outright rather
than warned about. The block editor accepts an address either way round, as
`0x7000` or as `28672`.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links. On
Run the IDE refuses to start if a block would overlap the BASIC program. See the
[machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly) — the PMD 85's MHB8080A is a
Tesla-made 8080A clone and every 8080 instruction is a Z80 instruction, so the
assembler assembles genuine 8080 code correctly. The reverse is not true: a
Z80-only instruction will run here but would not have run on the real machine.
