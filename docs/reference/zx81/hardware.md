---
title: ZX81 hardware
---

# ZX81 hardware

The screen, colour, graphics and sound hardware of each machine that runs
[ZX81 BASIC](../zx81), and where machine-code and data blocks live in its
memory.

## Sinclair ZX81

### Screen modes

The ZX81 has a single 32×24 character display, with the bottom two lines
reserved for input and reports. What it does have is two speed modes: `SLOW`
keeps the picture on screen continuously with the CPU running at about a
quarter speed, while `FAST` blanks the screen for full-speed computation,
flickering it on only during INPUT or PAUSE. When the screen is full, `SCROLL`
moves the whole display up a line — printing past the bottom without it stops
the program with report 5.

### Colour

The ZX81 has no colour hardware — the display is black on white. Individual
characters can be shown in inverse video (white on black) using the inverse
character set (see the [escape codes](./escapes) page).

### Graphics

There is no bitmap mode. `PLOT` and `UNPLOT` set and clear block pixels on a
low-resolution grid — x 0–63, y 0–43, origin at the bottom-left — where each
character cell is a 2×2 group of block pixels drawn with the charset's
block-graphics characters. The same characters can be printed directly for
chunky graphics (see [escape codes](./escapes)).

### Sound

The ZX81 has no sound hardware.

### Memory

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
