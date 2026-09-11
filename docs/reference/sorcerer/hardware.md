---
title: Exidy Standard BASIC hardware
---

<script setup>
import { sorcererMemoryMap } from '../../../src/dialects/sorcerer/memoryMap';
</script>

# Exidy Standard BASIC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Exidy Standard BASIC](../sorcerer), and where machine-code and data blocks live
in its memory.

## Exidy Sorcerer

### Screen modes

One mode, always: 64 characters across and 30 rows down, each an 8×8 cell, so
512×240 dots in all. There is no way to change it and nothing underneath it —
the video circuit walks 1920 bytes of screen RAM in reading order and, for each
byte, reads eight consecutive bytes of the character generator. A cell holds a
character code and nothing else.

The cell is square, which is unusual enough to be worth planning around: a shape
drawn 1:1 in character cells comes out with the proportions it was drawn in,
where most machines here stretch it.

There is no `CLS` and no `PRINT AT`. The screen is driven by control codes sent
through `PRINT` — `PRINT CHR$(12);` clears and homes, `CHR$(17)` homes without
clearing, and four more move the cursor a cell or a row at a time. They are the
Monitor's rather than the interpreter's, and the
[escape codes](./escapes) page lists every one of them. `PRINT TAB(n);`
positions across a line; anything else is a `POKE` into screen RAM.

The frame rate is not the round 50 or 60 Hz a reader may expect. A 12.638 MHz
dot clock, 806 dot times to a scan line and 261 lines to a frame leave a little
over 60 frames a second, and the Z80 takes the same crystal divided by six —
2.106 MHz.

### Colour

The Sorcerer has no colour hardware — the video output is a plain monochrome
composite signal, and the monitor Exidy sold with it was white on black. There
are no attributes in screen RAM to carry a colour even if there were one: a
cell is one byte, and all eight bits of it are the character code.

### Graphics

There are no pixels and no plotting keywords. What the machine has instead is
character graphics, in two bands of the character set:

- **Codes 128–191, the standard graphics set** — rules and junctions, corners
  and arcs, quadrants, halves, triangles, dithers, discs and the four card
  suits. They are printed with `CHR$(n)`, or typed with the **GRAPHIC** key and
  the key the shape is printed on the front of.
- **Codes 192–255, the user-definable set** — blank until a program defines
  them. A shape is eight bytes of bitmap, one per scan line, poked into the
  character generator RAM at `-1024+(code-128)*8`. **SHIFT** with **GRAPHIC**
  types these.

Both bands live in RAM rather than in the generator ROM, so the "standard" set
is standard only by convention: the Monitor copies it up at boot, and a program
is free to overwrite it. Drawing therefore means putting a character in a cell —
`POKE -3968+row*64+col, code` — and a program that redefines a character changes
what is already on the screen as well as what is printed next.

### Sound

The Sorcerer has no sound hardware, and Exidy Standard BASIC has no sound
keyword. The cassette output port can be driven by `OUT` into an external
amplifier, as it was on several machines of the period, but nothing is audible
here.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="sorcerer" :map="sorcererMemoryMap" />

Three things about this layout are not what the other maps here would lead you
to expect.

**The address space opens in RAM and the firmware is at the top.** There is no
ROM at address zero to boot from: the Monitor is mirrored over the bottom of
memory for exactly one instruction out of reset and is then gone, so what the
map draws underneath that mirror is the RAM which is there for the rest of the
session. The modelled machine has 32 KB of it, the configuration the sign-on
banner's `31976 BYTES FREE` was read from.

**The character generator is half ROM and half RAM.** Codes 0–127 come from ROM
at `0xF800` and cannot be changed; codes 128–255 are ordinary RAM at `0xFC00`,
which is what makes both graphics bands definable.

**BASIC's memory stops a page below the top of the fitted RAM**, not at it. The
cold start hands the Monitor the top 256 bytes — its variables at the very top
and its own stack growing down through the rest — and sets the interpreter's
ceiling to `0x7EFF`. Both halves are live whenever a Monitor routine runs, which
loading from tape is, so that page is not the free space it looks like.

A Sorcerer program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A
block may sit anywhere from `0x01D5`, where the program text starts, up to
`0x7EFF`; new blocks default to `0x7000`, high enough to be clear of any
plausible program and its variables and low enough to leave the stack and the
string pool room to grow down from the ceiling. Nothing in the window is merely
discouraged: the interpreter's own workspace below the program base and
everything above the ceiling are outside the valid range, so a block reaching
either is refused rather than warned about. The block editor accepts an address
either way round, as `0x7000` or as `28672`.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links,
they ride the machine's own tape as a memory-range file beside the program, and
they can arrive on **import**: every record on an imported tape that is not the
BASIC program comes in as a block at its own load address. On Run the IDE
refuses to start if a block would overlap the BASIC program.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly) — the Sorcerer really is a Z80, so a
block here may use the instructions that reference promises.
