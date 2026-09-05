---
title: Altair 8800 hardware
---

<script setup>
import { altair8800MemoryMap } from '../../../src/dialects/altair8800/memoryMap';
</script>

# Altair 8800 hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Altair 8K BASIC](../altair8800), and where machine-code and data blocks live in
its memory.

## MITS Altair 8800

### Screen modes

The Altair has no video hardware at all. BASIC writes characters to a serial
port and a terminal on the other end displays them, which here is an 80×24 green
screen. There is one "mode", it is text, and it scrolls: no cursor addressing, no
`CLS`, no screen memory to `POKE`, and nothing that can be redrawn once it has
scrolled off the top.

BASIC wraps at its own terminal width of 72 columns rather than at the edge of
the glass, so a `PRINT` line breaks eight columns short of the right margin —
that width is what the comma print zones are measured against. The terminal
itself acts on four control codes: carriage return, line feed, backspace (which
moves the carriage without erasing) and the bell. They are listed on the
[escape codes](./escapes) page.

### Colour

The Altair has no colour hardware — the output is a monochrome serial terminal.

### Graphics

The Altair has no graphics hardware and Altair 8K BASIC has no graphics
keywords: no `PLOT`, no `SET`, no block-graphics characters, and no
user-definable characters. Its whole output alphabet is 7-bit ASCII.

A picture is therefore built as characters and printed. The bundled Circles
sample shows the shape that works: fill a numeric array, then print it a row at
a time. Because a terminal cell is twice as tall as it is wide, halve the
vertical axis to keep a circle round.

Printing a whole picture from BASIC is slow, and nothing appears until the last
of it has been worked out. Where that wait matters, do the drawing in machine
code and send the characters to the terminal directly — the bundled
Kaleidoscope sample does exactly that, and BASIC only asks for the parameters.

### Sound

The Altair has no sound hardware. The only noise the machine can make is the
terminal bell, `CHR$(7)` — a physical gong on a Teletype ASR-33 — and nothing is
audible for it here.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="altair8800" :map="altair8800MemoryMap" />

An Altair program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. On the
Altair a block may sit from **0x1939 to 0xBFFF** (6457 to 49151 in decimal,
which is the notation BASIC itself uses); new blocks default to **0xB000**, high
in RAM clear of any plausible program and of the string pool at the very top of
memory. The block editor accepts an address either way round, as `0x1939` or as
`6457`.

Everything below that window is the interpreter. Altair 8K BASIC is not
firmware: it was loaded into RAM from paper tape and runs from address 0
upwards, so there is no read-only memory and nothing in the hardware to stop a
block — or a stray `POKE` — from overwriting BASIC itself. A block placed below
the window is rejected outright rather than warned about, which is the only
protection the machine has. The window stops at 0xBFFF because that is the top
of the 48K of memory boards this machine is fitted with; the address space above
it is empty backplane, which is what lets BASIC find the top of memory when it
starts.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links, and
can arrive on **import**: bytes found after the end-of-program marker in a
`CSAVE` image come back as a block at the address they followed the program at.
They do not travel the other way — `CSAVE` wrote the program area and nothing
else, so no Altair export carries a block, and the Transfer dialog says so before
writing one.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly) — the Altair's 8080 is the Z80's
ancestor and every 8080 instruction is a Z80 instruction, so the assembler
assembles genuine 8080 code correctly. The reverse is not true: a Z80-only
instruction will run here but would not have run on the real machine.
