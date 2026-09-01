---
title: Integer BASIC hardware
---

<script setup>
import { apple1MemoryMap } from '../../../src/dialects/apple1/memoryMap';
import { apple2MemoryMap } from '../../../src/dialects/apple2/memoryMap';
</script>

# Integer BASIC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Integer BASIC](../integer-basic), and where machine-code and data blocks live
in its memory. The two machines share the interpreter and almost none of the
board it runs on, so each has a section of its own.

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

That window is the free RAM below the stock LOMEM, and it is the only RAM BASIC
never touches — which is what lets this machine hold a routine and a program at
once. A program that lowers LOMEM with a
[preamble](../integer-basic#the-preamble-a-listing-opens-with) claims that RAM for its
own workspace instead, so it cannot also keep a block there.
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

## Apple II

### Screen modes

Three modes, drawn into one 280×192 raster, and no video chip behind any of
them: a counter chain walks memory in step with the raster and the byte it
fetches _is_ the picture, read three different ways.

| Mode   | What a byte is                      | Selected by                         |
| ------ | ----------------------------------- | ----------------------------------- |
| Text   | one of 64 characters, in a 7×8 cell | `TEXT`, and the machine's own start |
| Lo-res | two stacked colour blocks, each 7×4 | `GR`                                |
| Hi-res | seven dots, one to a bit            | not from BASIC — see below          |

Text is 40 columns by 24 rows of upper case. Lo-res is 40 blocks across by 48
down, of which `GR` shows the top 40 and keeps four lines of text under them —
`PLOT` still reaches rows 40 to 47, which sit behind that text window.

Hi-res is 280×192 and Integer BASIC cannot reach it: `HGR` and `HPLOT` are
Applesoft's, so the page is only reachable by `CALL` into machine code that pokes
it. It is drawn here in monochrome, every set dot white. That is a decision
rather than an omission — hi-res colour on this machine is pure NTSC artefacting,
where adjacent dots fringe into each other and a monitor's tint control changes
the answer, and a monochrome raster shows exactly which dots a program set.

The mode is not a register but four flip-flops at `$C050`–`$C057`, and _touching_
one of those addresses throws it: a `PEEK` does it as surely as a `POKE`, which is
why a BASIC with no `POKE` at all could still drive the display. No mode
addresses memory in raster order; a text row `r` starts at
`1024 + 128 × (r MOD 8) + 40 × (r ÷ 8)`, so a program reading the screen with
`PEEK` walks it that way rather than by multiplying by 40.

### Colour

Sixteen colours, and they belong to the lo-res page alone. `COLOR=n` picks the
one `PLOT`, `HLIN` and `VLIN` draw in, from 0 black to 15 white; the number is
taken modulo 16, so `COLOR=19` draws in colour 3. Colours 5 and 10 are the two
greys, and on the real machine they are not colours at all but four-bit patterns
beating against the colour subcarrier — a composite monitor's tint control moves
every one of them. The palette drawn here is Apple's own later digital
restatement of the sixteen, which separates those two greys into a dark and a
light one.

Text has no colour at all, and no coloured character to stand in for it. What the
text screen does have is inverse and flashing: the top two bits of a screen byte
pick the video mode the character generator draws that shape in, so a byte poked
into the text page can be normal, inverse or flashing. Printed text reaches them
through the monitor's output mask rather than through a control code —
`POKE 50,63` makes everything printed afterwards inverse, `POKE 50,127` flashing,
and `POKE 50,255` normal again. See the [escape codes](./escapes) page for how
the bytes themselves are written.

### Graphics

`GR` switches the lo-res screen on and clears it to black. `PLOT x,y` lights one
block, with `x` from 0 to 39 and `y` from 0 to 47, counting from the top left;
`HLIN a,b AT y` and `VLIN a,b AT x` draw runs; and `SCRN(x,y)` reads a block's
colour back, which means a program can keep its picture on the screen rather than
in an array. A coordinate outside those ranges stops the program with
`*** RANGE ERR`. `TEXT` switches back.

A lo-res block is 7 dots wide and 4 tall, so it is nearly twice as tall as it is
wide: a circle drawn with equal radii comes out as an upright ellipse, and its
horizontal radius wants scaling to about 4/7 of the vertical one to read round.

There are no graphics characters. The character generator holds 64 shapes —
space, punctuation, the digits and `A`–`Z` — and nothing else, so a picture on the
text screen is drawn from punctuation and a picture in colour is drawn on the
lo-res page.

### Sound

One bit, and not even a bit that can be written. `$C030` is wired to a flip-flop
driving the speaker cone, and touching the address flips it — the value written is
thrown away and a read does the job as well. Integer BASIC has no sound keyword
at all, so every note is a program counting between toggles: `PEEK(-16336)` in a
loop, with the loop's period as the pitch.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="apple2" :map="apple2MemoryMap" />

Forty-eight kilobytes of RAM run from `0x0000` to `0xBFFF`, the input and output
page sits at `0xC000`–`0xCFFF`, and the firmware fills `0xD000`–`0xFFFF` in four
sockets: Programmer's Aid #1 at `0xD000`, an empty one above it, Integer BASIC at
`0xE000`–`0xF7FF` and the monitor in the last two kilobytes. No peripheral cards
are fitted to the emulated machine, so the card space in the upper part of the
I/O page reads as `0xFF`, as does the empty socket.

BASIC works between LOMEM and HIMEM, and it works from both ends: the variables
grow **up** from LOMEM and the program grows **down** from HIMEM. The cold start
puts them at `0x0800` and the top of RAM, which is 47104 bytes for the two
together, and when the two ends meet the machine answers `*** MEM FULL ERR`. A
listing can move either with a
[`LOMEM:` / `HIMEM:` preamble](../integer-basic#the-preamble-a-listing-opens-with).

An Apple II program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A block
may sit from **0x0300 to 0x03FF** (768 to 1023 in decimal, which is the notation
BASIC itself uses, having no hexadecimal at all); new blocks default to
**0x0300**. The block editor accepts an address either way round, as `0x0300` or
as `768`.

That single page is all the free RAM there is. Everything below it belongs to the
interpreter, the stack and the line buffer the monitor assembles a typed line in,
`0x0400`–`0x07FF` is the text screen, and the stock workspace claims
`0x0800`–`0xBFFF` outright — so unlike a machine that grows its program up from a
base, there is no free RAM above the program either. A block outside the window
is rejected rather than warned about. The last eight bytes, `0x03F8`–`0x03FF`,
are the monitor's vector block: a block reaching into them is a warning rather
than an error, because nothing writes them and a program that raises none of the
three jumps through them never notices.

A program that lowers LOMEM claims part of the block window for its own
workspace, so it cannot both do that and keep a block there.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links. No
cassette export carries them: `SAVE` writes the program workspace and nothing
else, and the block window is outside it.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
