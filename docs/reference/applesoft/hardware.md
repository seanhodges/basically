---
title: Applesoft BASIC hardware
---

<script setup>
import { apple2plusMemoryMap } from '../../../src/dialects/apple2plus/memoryMap';
</script>

# Applesoft BASIC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Applesoft BASIC](../applesoft), and where machine-code and data blocks live in
its memory.

## Apple II Plus

### Screen modes

Three modes, drawn into one 280×192 raster, and no video chip behind any of
them: a counter chain walks memory in step with the raster and the byte it
fetches _is_ the picture, read three different ways.

| Mode   | What a byte is                      | Selected by                         |
| ------ | ----------------------------------- | ----------------------------------- |
| Text   | one of 64 characters, in a 7×8 cell | `TEXT`, and the machine's own start |
| Lo-res | two stacked colour blocks, each 7×4 | `GR`                                |
| Hi-res | seven dots, one to a bit            | `HGR` (page 1), `HGR2` (page 2)     |

Text is 40 columns by 24 rows of upper case. Lo-res is 40 blocks across by 48
down, of which `GR` shows the top 40 and keeps four lines of text under them —
`PLOT` still reaches rows 40 to 47, which sit behind that text window. Hi-res is
280 by 192, of which `HGR` shows the top 160 with four lines of text under them
and `HGR2` shows all of it with none; `HPLOT` reaches the whole page either way.

Both hi-res pages are ordinary RAM inside the workspace — page 1 at 8192 and
page 2 at 16384 — and neither `HGR` nor `HGR2` moves the ends of that workspace.
The cold start reserves nothing between the program and the top of memory, so a
program of about six kilobytes has already grown into page 1 and `HGR` will erase
what it grew into. `HIMEM: 8192` before the first `HGR` is what reserves the page,
and `HIMEM: 16384` does the same for `HGR2`.

Hi-res is drawn here in monochrome, every set dot white. That is a decision
rather than an omission — hi-res colour on this machine is pure NTSC
artefacting, where adjacent dots fringe into each other and a monitor's tint
control changes the answer, and a monochrome raster shows exactly which dots a
program set. `HCOLOR=` still selects among the eight values, and the palette bit
still shifts a byte's dots half a pixel; what does not happen is the fringing.

The mode is not a register but four flip-flops at `$C050`–`$C057`, and _touching_
one of those addresses throws it: a `PEEK` does it as surely as a `POKE`.
`GR`, `HGR`, `HGR2` and `TEXT` are those four switches thrown in the right order.
No mode addresses memory in raster order; a text row `r` starts at
`1024 + 128 × (r MOD 8) + 40 × (r ÷ 8)`, so a program reading the screen with
`PEEK` walks it that way rather than by multiplying by 40.

### Colour

Sixteen colours on the lo-res page and eight in hi-res, and none at all in text.

`COLOR=n` picks the one `PLOT`, `HLIN` and `VLIN` draw in, from 0 black to 15
white; the number is taken modulo 16, so `COLOR=19` draws in colour 3. Colours 5
and 10 are the two greys, and on the real machine they are not colours at all but
four-bit patterns beating against the colour subcarrier — a composite monitor's
tint control moves every one of them. The palette drawn here is Apple's own later
digital restatement of the sixteen, which separates those two greys into a dark
and a light one. `SCRN(x,y)` reads a block's colour back.

`HCOLOR=n` picks one of eight for `HPLOT`, `DRAW` and `XDRAW`: 0 black, 1 green,
2 violet, 3 white, 4 black again, 5 orange, 6 blue and 7 white again. On the real
machine those are not a palette but artefacts of which dot positions are lit —
the second set is the first with the palette bit set, which shifts a byte's dots
half a pixel and turns green into orange and violet into blue. That is also why
two of the eight are black and two are white: both whites simply light every dot.

Text has no colour and no coloured character to stand in for it. What the text
screen does have is inverse and flashing: the top two bits of a screen byte pick
the video mode the character generator draws that shape in. `INVERSE`, `FLASH`
and `NORMAL` set which of the three everything printed afterwards uses, and a
byte poked straight into the text page carries its own. See the
[escape codes](./escapes) page for how those bytes are written in source.

### Graphics

Lo-res first. `GR` switches the lo-res screen on and clears it to black.
`PLOT x,y` lights one block, with `x` from 0 to 39 and `y` from 0 to 47, counting
from the top left; `HLIN a,b AT y` and `VLIN a,b AT x` draw runs; and `SCRN(x,y)`
reads a block's colour back, which means a program can keep its picture on the
screen rather than in an array. A coordinate outside those ranges stops the
program with `?ILLEGAL QUANTITY ERROR`. A lo-res block is 7 dots wide and 4 tall,
so a circle drawn with equal radii comes out as an upright ellipse and its
horizontal radius wants scaling to about 4/7 of the vertical one to read round.

Hi-res is the half the Apple II's Integer BASIC cannot reach at all.
`HPLOT x,y` lights one dot, with `x` from 0 to 279 and `y` from 0 to 191;
`HPLOT x,y TO x2,y2 TO x3,y3` draws a run of lines through every point named; and
`HPLOT TO x,y` continues from wherever the last plot left off, which is how a
shape is drawn without repeating its corners. There is no `CIRCLE` and no `FILL`
— a curve is a run of `HPLOT`s and a solid region is a run of lines — and there
is no reading a hi-res dot back, `SCRN(` being lo-res only.

`DRAW` and `XDRAW` place a **shape** from a shape table, at the current
`HCOLOR=`, `ROT=` (0 to 63) and `SCALE=` (1 to 255). A shape table is a block of
bytes holding a directory and then a list of plot-and-move steps; its address goes
in locations 232 and 233 before the first `DRAW`. `XDRAW` inverts every dot it
covers instead of setting it, so drawing the same shape twice in the same place
leaves the screen as it was — which is how a moving shape is erased without
keeping a copy of the background. `SHLOAD` reads a shape table from cassette on a
real machine; here a table travels as a memory block instead.

There are no graphics characters. The character generator holds 64 shapes —
space, punctuation, the digits and `A`–`Z` — and nothing else, so a picture on the
text screen is drawn from punctuation and a picture in colour is drawn on the
lo-res or hi-res page.

### Sound

One bit, and not even a bit that can be written. `$C030` is wired to a flip-flop
driving the speaker cone, and touching the address flips it — the value written is
thrown away and a read does the job as well. Applesoft has no sound keyword at
all, so every note is a program counting between toggles: `PEEK(-16336)` in a
loop, with the loop's period as the pitch.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="apple2plus" :map="apple2plusMemoryMap" />

Forty-eight kilobytes of RAM run from `0x0000` to `0xBFFF`, the input and output
page sits at `0xC000`–`0xCFFF`, and the firmware fills `0xD000`–`0xFFFF`:
Applesoft in one unbroken run from `0xD000` to `0xF7FF`, and the Autostart
Monitor in the last two kilobytes. There is no Programmer's Aid socket and no
empty one — that is what the Apple II has in the space this machine's BASIC
occupies. No peripheral cards are fitted to the emulated machine, so the card
space in the upper part of the I/O page reads as `0xFF`.

BASIC works upwards and downwards at once. The program starts at `0x0801` —
always, whatever the machine's memory — with its scalar variables and then its
arrays directly above it, while the string space fills **down** from the top of
RAM. The free space is the gap in the middle, which is what `FRE(0)` measures; the
two ends meeting is `?OUT OF MEMORY ERROR`. `HIMEM:` moves the top and `LOMEM:`
the bottom of the variables.

The workspace begins one byte below the program, at `0x0800`, and that byte is
load-bearing: the cold start leaves a zero there and `RUN` scans from it, so
anything else is read as part of a line record and the program fails on a line
number no listing could hold. `LIST` starts at the program proper and is
unbothered, which is why a program damaged this way still lists back perfectly.

An Apple II Plus program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A block
may sit from **0x0300 to 0x03FF** (768 to 1023 in decimal, which is the notation
BASIC itself uses, having no hexadecimal at all); new blocks default to
**0x0300**. The block editor accepts an address either way round, as `0x0300` or
as `768`.

That single page is all the free RAM there is. Everything below it belongs to the
interpreter, the stack and the line buffer the monitor assembles a typed line in,
`0x0400`–`0x07FF` is the text screen, and the stock workspace claims
`0x0800`–`0xBFFF` outright — the program from one end and the strings from the
other — so there is no free RAM above the program either. A block outside the
window is rejected rather than warned about. The last sixteen bytes,
`0x03F0`–`0x03FF`, are the firmware's vector block: a block reaching into them is
a warning rather than an error, because only the first five are written by the
firmware and a program that never presses RESET, never uses `&` and raises no
interrupt never notices. `0x03F2`–`0x03F4` is the one to keep clear of — the
Autostart Monitor checks those three on every RESET and cold-starts when they
disagree, which turns the RESET key from "come back to the listing" into "lose
it".

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links. No
cassette export carries them: `SAVE` writes the program workspace and nothing
else, and the block window is outside it.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
