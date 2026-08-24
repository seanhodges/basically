---
title: Apple I hardware
---

<script setup>
import { apple1MemoryMap } from '../../../src/dialects/apple1/memoryMap';
</script>

# Apple I hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Apple 1 Integer BASIC](../apple1), and where machine-code and data blocks live
in its memory.

## Apple I

### Screen modes

One screen, and no way to select another. The terminal section is a shift
register holding a 40×24 grid of six-bit character codes, a character generator
turning each into a 5×7 dot pattern, and a page of logic sequencing the two:
280×192 dots in all, at a 7×8 cell. A flashing `@` marks where the next
character will go.

Two consequences shape every program written for it. The first is that the
shift register has to rotate once for a character to be inserted, so the machine
writes exactly **one character per video field** — sixty a second — and BASIC
waits on it. A full screen takes about sixteen seconds, and a program that
prints each cell as it works it out costs nothing extra for the arithmetic,
because it was going to wait anyway.

The second is that **carriage return is the only code the display acts on**.
There is no line feed, no backspace, no clear-screen and no cursor addressing;
the screen scrolls up a line when the bottom is passed, and nothing already
printed can be changed. A picture that changes is printed again. The board's
own CLEAR SCREEN button blanks the display, but it is wired to the video logic
rather than to the processor, so no program can press it.

The character set is the 64 shapes the generator holds — ASCII `0x20`–`0x5F`:
space, punctuation, the digits and `A`–`Z`. There is no lower case anywhere,
and the interpreter refuses a lower-case name or keyword outright. Anything the
generator cannot draw is discarded rather than guessed at. The
[escape codes](./escapes) page lists what a program can hold.

### Colour

The Apple I has no colour hardware: the video output is monochrome, and there is
no inverse-video range in the character set to stand in for it.

### Graphics

The Apple I has no graphics hardware and no graphics characters. Pictures are
drawn on the text grid from the 64 characters there are; a cell is 7 dots wide
and 8 tall, so a shape needs about eight columns for every seven rows to read
round rather than squashed.

`COLOR=`, `PLOT`, `HLIN` and `AT` are in the interpreter's syntax table — Woz's
work towards the Apple II, left in an Apple I image — and reach a machine with
nothing to draw on. The editor names each one rather than letting a program use
it.

### Sound

The Apple I has no sound hardware. There is no speaker, no bell code and no port
to click at.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="apple1" :map="apple1MemoryMap" />

Four kilobytes of RAM sit at the bottom of the map, one page of input and output
at `0xD010`, the block Integer BASIC is loaded into at `0xE000`, and the monitor
in the last page. Everything between `0x1000` and `0xCFFF` is simply not there:
nothing answers, and a read returns `0xFF`.

BASIC works in `0x0800`–`0x0FFF`, and it works from both ends: the variables
grow **up** from LOMEM and the program grows **down** from HIMEM. That is
2048 bytes for the two together, the smallest workspace of any machine here, and
when the two ends meet the machine answers `*** MEM FULL ERR`.

An Apple I program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A
block may sit from **0x0300 to 0x07FF** (768 to 2047 in decimal, which is the
notation BASIC itself uses, since it has no hexadecimal at all); new blocks
default to **0x0300**. The block editor accepts an address either way round, as
`0x0300` or as `768`.

That window is the free RAM below LOMEM, and it is the only RAM BASIC never
touches — which is what lets this machine hold a routine and a program at once.
It stops short of `0x0280` because the monitor assembles a typed line at
`0x0200`–`0x027F` and the interpreter crunches it to tokens there, so a block
reaching into that page is overwritten by the next thing typed, the `RUN` that
starts the program included. A block outside the window is rejected rather than
warned about.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
