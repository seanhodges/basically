---
title: Sinclair BASIC hardware
---

<script setup>
import { zx81MemoryMap } from '../../../src/dialects/zx81/memoryMap';
import { spectrumMemoryMap } from '../../../src/dialects/zxspectrum/memoryMap';
import { spectrum128MemoryMap } from '../../../src/dialects/zxspectrum128/memoryMap';
</script>

# Sinclair BASIC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Sinclair BASIC](../sinclair), and where machine-code and data blocks live in
its memory. A ZX81 and a Spectrum 128 share a BASIC and almost no hardware at
all, so each machine has a section of its own.

## Sinclair ZX81

### Screen modes {#zx81-screen-modes}

The ZX81 has a single 32×24 character display, with the bottom two lines
reserved for input and reports. What it does have is two speed modes: `SLOW`
keeps the picture on screen continuously with the CPU running at about a
quarter speed, while `FAST` blanks the screen for full-speed computation,
flickering it on only during INPUT or PAUSE. When the screen is full, `SCROLL`
moves the whole display up a line — printing past the bottom without it stops
the program with report 5.

### Colour {#zx81-colour}

The ZX81 has no colour hardware — the display is black on white. Individual
characters can be shown in inverse video (white on black) using the inverse
character set (see the [escape codes](./escapes) page).

### Graphics {#zx81-graphics}

There is no bitmap mode. `PLOT` and `UNPLOT` set and clear block pixels on a
low-resolution grid — x 0–63, y 0–43, origin at the bottom-left — where each
character cell is a 2×2 group of block pixels drawn with the charset's
block-graphics characters. The same characters can be printed directly for
chunky graphics (see [escape codes](./escapes)).

### Sound {#zx81-sound}

The ZX81 has no sound hardware.

### Memory {#zx81-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="zx81" :map="zx81MemoryMap" />

A ZX81 program can carry machine code or data — **memory blocks** — using the
classic trick of hiding the bytes inside a `REM` line. Because a `.P` file holds
only the BASIC program, this is the one place code can live that still travels in
the single standard `.P` file that real emulators and hardware load: the bytes
sit in the program itself.

Each hidden-code `REM` line shows in the editor as a **block tab** alongside the
BASIC tab. Open the tab to edit the block's assembly; saving rewrites the hidden
`REM` line for you, so the machine code always stays part of the program listing.
Add a new block with the **+** button on the tab strip, or import a `.P` that
already contains one — the IDE recognises the hidden code and gives it a tab.

A block's **address is fixed by where its `REM` line sits** in the program. The
first line's `REM` body lands at the famous **16514**, so a block placed there is
reached with `RAND USR 16514` (or `PRINT PEEK 16514`). The address is shown in the
block tab and can't be typed in — move the `REM` line to change it. You can mark a
block as **code** or **data** and give it a name; those labels are remembered in
the [project bundle](../file-formats#project-bundle-zip).

Because the bytes live in the listing, they export and import with the ordinary
`.P` file — no separate file, and it runs on a real ZX81 unchanged.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).

## ZX Spectrum 48K

### Screen modes {#spectrum48-screen-modes}

The Spectrum has a single display mode: a 256×192 pixel bitmap overlaid by a
32×24 grid of colour attribute cells. The top 22 character rows hold program
output; the bottom two lines are reserved for input and reports.

### Colour {#spectrum48-colour}

Eight colours (0 black to 7 white) are available for `INK` (foreground),
`PAPER` (background) and `BORDER`, with two per-cell modifiers: `BRIGHT` for
high intensity and `FLASH` to alternate ink and paper. Colour is stored one
ink/paper pair per 8×8 attribute cell, so two differently-coloured shapes in
the same cell clash — the classic Spectrum attribute clash. `ATTR` reads a
cell's attribute byte back; `INVERSE` and `OVER` modify how following output is
drawn.

### Graphics {#spectrum48-graphics}

`PLOT <x>, <y>` sets a pixel — x runs 0–255 and y 0–175 from the bottom-left.
`DRAW <dx>, <dy>` draws a line by a relative offset — unlike most machines here,
which draw to an absolute point — and a third argument bends it into an arc.
`CIRCLE <x>, <y>` takes an absolute centre and a radius, and the `POINT` function
tests whether a pixel is set.

### Sound {#spectrum48-sound}

`BEEP <duration>, <pitch>` plays a tone through the internal beeper — the duration
in seconds and the pitch in semitones above or below middle C.

### Timing {#spectrum48-timing}

The Spectrum's processor runs at 3.5 MHz over 312 screen lines a frame, just
over fifty frames a second.

Not all of that time is the program's. The display chip reads the picture out of
the same 16K of memory the processor uses — everything from 16384 to 32767, which
is where the screen, the BASIC program and its variables all live — and while it
is fetching a line it holds the processor off the memory for up to six clock
cycles at a time. Over a frame that is a real slice of the machine: an identical
routine runs several per cent faster from 32768 upwards, where the display chip
never looks, than it does from below. It is why a delay written as `FOR n=1 TO
1000` is worth timing rather than calculating, and why moving a machine-code
routine above 32768 speeds it up for nothing.

The same sharing is what makes the Spectrum's multicolour effects possible.
Because the processor is held off in a pattern that repeats with the picture, a
routine that rewrites colour attributes as the screen is drawn is pulled into
step with the beam on every pass, and its coloured bands hold still instead of
sliding. A routine timed on a real Spectrum keeps that relationship here.

Fifty times a second the display hardware interrupts the processor, and it holds
the request there for a moment rather than raising it for a single instant — so
a routine that has interrupts switched off just as a frame turns over still
receives that frame's interrupt once it switches them back on, provided it does
so promptly. Leave them off for longer and the frame's interrupt is missed, as it
is on the machine.

### Memory {#spectrum48-memory}

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

### Screen modes {#spectrum128-screen-modes}

The display hardware is the 48K's: the same single 256×192 bitmap mode with
32×24 attribute cells.

### Colour {#spectrum128-colour}

Identical to the 48K — the same eight colours, `BRIGHT`, `FLASH` and per-cell
attributes.

### Graphics {#spectrum128-graphics}

Identical to the 48K — the same `PLOT`/`DRAW`/`CIRCLE` commands and coordinate
space.

### Sound {#spectrum128-sound}

Alongside the 48K beeper and `BEEP`, the 128K models add an AY-3-8912
three-channel sound chip, driven from BASIC with `PLAY` — one music string per
channel. Keywords tagged **128K only** in the
[reference table](../sinclair), such as `PLAY`, need 128 BASIC mode.

### Timing {#spectrum128-timing}

The 128K shares the picture out the same way the 48K does, on a slightly
different clock: 3.5469 MHz over 311 lines a frame. The memory from 16384 to
32767 is held off while the display is drawn, exactly as
[above](#spectrum48-timing) — and so is whichever of the extra memory banks a program has
switched into the top 16K, if it is an odd-numbered one. The same routine can
therefore run at two different speeds at 49152 depending only on which bank is
switched in there.

### Memory {#spectrum128-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="zxspectrum128" :map="spectrum128MemoryMap" />

Block placement is identical to the 48K: the same **0x4000–0xFFFF** window,
default address, warnings and `CLEAR` handling described
[above](#spectrum48-memory) apply to the 128K models.
