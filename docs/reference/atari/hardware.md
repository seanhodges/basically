---
title: Atari hardware
---

<script setup>
import { atari800MemoryMap } from '../../../src/dialects/atari800/memoryMap';
import { atari400MemoryMap } from '../../../src/dialects/atari400/memoryMap';
</script>

# Atari hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Atari BASIC](../atari), and where machine-code and data blocks live in its
memory.

The two machines are one design fitted with different amounts of RAM. The
display, colour, sound and controller hardware below is the same on both — the
same 6502 at 1.79 MHz, the same ANTIC, GTIA, POKEY and PIA — so only the
[Atari 400's memory](#atari400-memory) differs, and it differs in one number.

## Atari 800

### Screen modes {#atari800-screen-modes}

`GRAPHICS <mode>` selects a mode, clears the screen and rebuilds the display
list. The picture and its display list are laid out downwards from the top of
fitted RAM every time, so the screen has no fixed address: `PEEK(88) +
256 * PEEK(89)` is where it currently starts.

| Mode          | Kind     | Cells / pixels | Colours                   |
| ------------- | -------- | -------------- | ------------------------- |
| `GRAPHICS 0`  | text     | 40 × 24        | 1, in two luminances      |
| `GRAPHICS 1`  | text     | 20 × 24        | 5                         |
| `GRAPHICS 2`  | text     | 20 × 12        | 5                         |
| `GRAPHICS 3`  | graphics | 40 × 24        | 4                         |
| `GRAPHICS 4`  | graphics | 80 × 48        | 2                         |
| `GRAPHICS 5`  | graphics | 80 × 48        | 4                         |
| `GRAPHICS 6`  | graphics | 160 × 96       | 2                         |
| `GRAPHICS 7`  | graphics | 160 × 96       | 4                         |
| `GRAPHICS 8`  | graphics | 320 × 192      | 1, in two luminances      |
| `GRAPHICS 9`  | graphics | 80 × 192       | 16 luminances of one hue  |
| `GRAPHICS 10` | graphics | 80 × 192       | 9, from the whole palette |
| `GRAPHICS 11` | graphics | 80 × 192       | 16 hues at one luminance  |

Modes 1 to 8 keep a **four-line text window** at the foot of the screen, where
`PRINT` and `INPUT` go while the picture stays untouched. Adding 16 to the mode
number drops it — `GRAPHICS 8+16` is the full 320 × 192 screen — and adding 32
keeps what is already on the screen instead of clearing it.

The window costs display, not coordinates. The figures above are the whole
picture, and they stay the whole picture with the window present: in
`GRAPHICS 8` the machine still accepts `PLOT 0, 191`, it simply shows the top
160 rows. Anything drawn below that is in memory and off the screen until the
mode is re-selected with 16 added. Modes 9 to 11 have no text window at all, so
the 16 makes no difference to them.

Modes 9, 10 and 11 are GTIA modes: the same 320 × 192 bitmap the display
processor draws for `GRAPHICS 8`, read four bits at a time by the colour chip
instead of one. That is where the wide pixel and the deep palette both come
from.

`GRAPHICS 0` is the 40 × 24 text screen BASIC sits in at its prompt. Never
print into column 39: the screen editor reads a character written there as the
end of a logical line and pushes the rest of the screen down a row — which tears
a drawn picture several moves after the fact. Stop at column 38.

### Colour {#atari800-colour}

`SETCOLOR <register>, <hue>, <luminance>` says what colour one of the five
colour registers holds, as a hue from 0 to 15 and a brightness from 0 to 14.
Only the even luminances are distinct — the chip ignores the bottom bit — so the
palette a program can name is 16 hues × 8 brightnesses, 128 colours in all, plus
the greys of hue 0.

`COLOR <colour>` is the other half of the pair, and it chooses the register
rather than the colour: it says which register `PLOT` and `DRAWTO` will draw
with next. In a text mode `COLOR` is instead the ATASCII code of the character
to draw.

In `GRAPHICS 0` the whole screen is one colour: register 2 is the background,
register 1 supplies the characters' luminance against it, and register 4 is the
border. A program that wants the text screen to change colour animates the
background rather than colouring one word. Modes 1 and 2 are the exception —
there a character's own code chooses one of four colour registers, so those two
text modes carry five colours at once.

Setting a colour through `SETCOLOR` writes a shadow location in low memory that
the vertical-blank routine copies to the chip fifty times a second. `POKE`ing
the hardware register directly is undone at the next frame; `POKE` the shadow
instead.

### Graphics {#atari800-graphics}

`PLOT <x>, <y>` draws one point in the register `COLOR` selected and leaves the
graphics cursor there; `DRAWTO <x>, <y>` draws a straight line on from it. The
origin is the top-left corner, x runs right and y runs down, and the ranges are
the ones in the mode table above. `LOCATE <x>, <y>, <numvar>` reads a point back
— the register number in a graphics mode, the character's code in a text one —
which is how a game finds out what it is about to move into. `XIO 18` fills an
area outlined by plotted lines.

Text modes have block and line graphics of their own: ATASCII `0` to `26` are
the shapes printed on the fronts of the keycaps, typed with CTRL and the key
they are drawn on, and every character has an inverse-video twin 128 codes
higher. An inverse space is a solid block, which is how a text-mode game draws
bricks, walls and a paddle. The [escape codes](./escapes) page lists what a
program can hold.

The machine's players and missiles — hardware sprites — are not reachable from
BASIC: there is no keyword for them, and driving them means `POKE`ing GTIA and
handing it a page of RAM. That is machine-code work, and the
[memory](#atari800-memory) section below is where a routine to do it goes.

### Sound {#atari800-sound}

`SOUND <voice>, <pitch>, <distortion>, <volume>` plays a tone on one of POKEY's
four voices and keeps playing it until the voice is changed or the program ends.
The voice is 0 to 3, and all four can sound at once.

Pitch is a divider from 0 to 255, so a **lower** number is a **higher** note.
Distortion is an even number from 0 to 14: 10 is a pure tone, 14 a lower-pitched
pure tone, and the values below them are the noise settings a program uses for
explosions and engines. Volume runs 0 to 15, and the four voices are summed
before they leave the chip, so four voices at full volume distort — keep the
total at or below 32.

`SOUND <voice>, 0, 0, 0` silences one voice; `END` silences all four. `STOP`
and the BREAK key do not, so a program halted mid-note keeps sounding it.

The console buzzer is separate from POKEY: printing the `{bell}` escape clicks
the speaker directly, through whatever the four voices are doing.

### Memory {#atari800-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="atari800" :map="atari800MemoryMap" />

Forty-eight kilobytes are fitted, but a BASIC program has nothing like 48K. The
cartridge covers everything from 40960 (`0xA000`) and holds the RAM behind it
off the bus, the operating system keeps the first two kilobytes, and the screen
and its display list come off the top — so the program area runs from 2048
(`0x0800`) up to about 39968, and `FRE(0)` reports what is left of it. Selecting
a graphics mode takes more off the top than the text screen does.

An Atari program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A
block may sit anywhere from **1024** (`0x0400`) to the top of fitted RAM, and
new blocks are offered **1536** (`0x0600`) — page 6, the one page of this map
that neither the operating system nor BASIC ever writes to, and where an Atari
machine-code routine has always gone. Addresses are shown in decimal here,
because Atari BASIC has no hexadecimal and a `POKE` has to be written that way;
the block editor accepts either notation.

Two bands inside that window are reserved with a warning rather than refused.
**1024–1535** (`0x0400`–`0x05FF`) is the operating system's buffers — the
cassette record, the spare page a disk system would take, and the line buffer
every `PRINT` passes through — so a block there survives only while the program
leaves the devices alone. The top **992 bytes** are the screen and its display
list, which is the _least_ a mode will claim: a graphics mode takes more, so a
block near the ceiling is certain to be overwritten.

No Atari file export carries blocks. Page 6 is outside what `SAVE` and `CSAVE`
write — the machine's own save routines write BASIC's program area and nothing
else — so blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links
instead. On Run the IDE refuses to start if a block would overlap the BASIC
program.

`X = USR(<addr>)` calls a routine. `USR` pushes the arguments it was given and
then a byte counting them, so the routine must `PLA` that count before anything
else or its `RTS` returns into nothing.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).

## Atari 400

### Screen modes {#atari400-screen-modes}

Identical to the Atari 800 — the same ANTIC and the same operating system, so
the same `GRAPHICS` modes and the same text window. The 400 simply has less
room to hold a screen in: `GRAPHICS 8` needs about 8K of the 16K fitted, which
is half the machine, and a program that wants the high-resolution modes has
little space left for itself.

### Colour {#atari400-colour}

Identical to the 800 — the same GTIA, the same five colour registers and the
same `SETCOLOR` / `COLOR` pair described [above](#atari800-colour).

### Graphics {#atari400-graphics}

Identical to the 800. The 400's keyboard is a flat membrane rather than moving
keys, but the graphics characters it types are the same ATASCII codes.

### Sound {#atari400-sound}

Identical to the 800 — the same POKEY and the same four-voice `SOUND`.

### Memory {#atari400-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="atari400" :map="atari400MemoryMap" />

As on the 800, but RAM ends at **16384** (`0x4000`), and everything between
there and the cartridge is empty sockets: the operating system sizes the memory
at power-on by writing to it and reading it back, and stops where the writes
stop sticking. The screen and its display list come off the top of the 16K
rather than the 48K, so the program area runs from 2048 up to about 15392.

The same block window, the same default of 1536, the same two warned bands and
the same run-time checks described [above](#atari800-memory) apply — the top of the
window moves down with the RAM, and nothing else changes.
