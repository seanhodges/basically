---
title: MSX hardware
---

<script setup>
import { hb10pMemoryMap } from '../../../src/dialects/hb10p/memoryMap';
</script>

# MSX hardware

The screen, colour, graphics and sound hardware of each machine that runs
[MSX BASIC](../msx), and where machine-code and data blocks live in its memory.

## Sony HB-10P

### Screen modes

Pick a mode with `SCREEN`:

| Mode       | Text    | Graphics  | Colours                                |
| ---------- | ------- | --------- | -------------------------------------- |
| `SCREEN 0` | 40 × 24 | —         | One pair for the whole screen          |
| `SCREEN 1` | 32 × 24 | —         | One pair per eight character codes     |
| `SCREEN 2` | —       | 256 × 192 | One pair per eight-pixel row of a cell |
| `SCREEN 3` | —       | 64 × 48   | Any of the sixteen per block           |

Two things about the text screens catch people out. **Neither opens at its full
width**: this machine boots `SCREEN 0` at 37 columns and `SCREEN 1` at 29, with
the narrower window centred, so a program that lays text out by column follows
its `SCREEN` with a `WIDTH 40` or `WIDTH 32`. And **`PRINT` draws nothing at all
in `SCREEN 2` and `SCREEN 3`** — no output, and no error either. Text on a
graphics screen goes through the `GRP:` device, which is slow enough to be worth
avoiding:

```basic
10 SCREEN 2
20 OPEN "GRP:" AS #1
30 PSET (40,80) : PRINT #1,"HELLO"
```

The bottom row of the screen shows the function-key strip until `KEY OFF`, which
is why most full-screen programs begin with it. `LOCATE` takes the column first
and counts both from 0.

The emulator's canvas is 320 × 240: the chip's 256 × 192 active window plus a
border. The border is a crop rather than a measurement — a real PAL frame off
this part is much wider than any screen wants.

### Colour

Sixteen colours, fixed in the silicon. There is no palette register on this
video chip, so these are the whole colour model:

| Code | Colour       | Code | Colour       |
| ---- | ------------ | ---- | ------------ |
| 0    | Transparent  | 8    | Medium red   |
| 1    | Black        | 9    | Light red    |
| 2    | Medium green | 10   | Dark yellow  |
| 3    | Light green  | 11   | Light yellow |
| 4    | Dark blue    | 12   | Dark green   |
| 5    | Light blue   | 13   | Magenta      |
| 6    | Dark red     | 14   | Grey         |
| 7    | Cyan         | 15   | White        |

`COLOR <foreground>, <background>, <border>` sets all three, and colour 0 is
transparent rather than a colour: where it is drawn, the border colour shows
through.

How finely colour can be placed is the whole difference between the screen
modes. In `SCREEN 1` the colour table holds one foreground/background pair for
every **group of eight character codes**, and `COLOR` writes the same pair into
all of them — so one statement recolours every character already on the screen,
and per-line colour has to be built by hand with `VPOKE` into the colour table.
In `SCREEN 2` each cell has a pair for every one of its eight pixel rows, which
is as close to per-pixel colour as this chip comes.

### Graphics

`PSET`, `PRESET`, `LINE`, `CIRCLE`, `PAINT` and `DRAW` draw in `SCREEN 2`
(256 × 192) and `SCREEN 3` (64 × 48), with the origin at the top left;
`POINT(<x>, <y>)` reads a pixel back. `LINE` with `B` draws a box and with `BF`
fills it, and `LINE -(<x>, <y>)` continues from the last point plotted.

**Sprites are the machine's own animation**, and are what the picture on an MSX
game is mostly made of. `SCREEN 2,2` selects 16 × 16 sprites (mode 0 and 1 are
8 × 8, and the odd sprite modes magnify each pixel to a 2 × 2 block).
`SPRITE$(<n>) = <string>` defines a shape from eight bytes for a small sprite or
thirty-two for a large one, and `PUT SPRITE <plane>, (<x>, <y>), <colour>, <n>`
places it. There are 32 planes, drawn lowest number first; **at most four appear
on any one scanline** and the fifth silently vanishes, which is a design
constraint rather than a bug. `ON SPRITE GOSUB` traps the moment two of them
overlap.

The picture lives in the video chip's own **16 KB of video RAM**, which is a
second address space the processor cannot address: `POKE` and `PEEK` do not
reach it. `VPOKE` and `VPEEK` are how a program reads and writes it, `BASE(<n>)`
says where each of the chip's tables sits, and writing the name table directly
is how an MSX program puts characters on the screen faster than `LOCATE` and
`PRINT` can:

```basic
10 SCREEN 1
20 VPOKE BASE(5)+ROW*32+COL,ASC("*")
```

### Sound

A programmable sound generator with **three tone channels and one noise
generator**, clocked at half the processor's 3.58 MHz. The part is a YM2149F
inside the Yamaha MSX-Engine chip, register-compatible with the AY-3-8912 of the
Spectrum 128 and the Amstrad CPC.

`BEEP` is the single click. `PLAY` takes up to three music macro strings, one per
channel, and **returns immediately** — the music plays on underneath the program,
so a game can start a sound and carry straight on:

```basic
10 PLAY "T120V15O4L8CDEFG","O3L4CEG"
```

Inside a string, `A`–`G` (with `#` and `-`) are notes, `O` sets the octave, `L`
the note length, `T` the tempo, `V` the volume, `R` a rest and `S`/`M` the
envelope shape and period.

`SOUND <register>, <value>` writes the chip's registers directly — 0 to 5 the
three tone periods, 6 the noise period, 7 the mixer, 8 to 10 the channel
volumes, 11 to 13 the envelope. The noise channel can be reached no other way,
so explosions and white noise go through `SOUND` rather than `PLAY`.

### Joystick

Two general-purpose ports, read through the sound chip's own input register
rather than through the key matrix, and each carrying **two** triggers rather
than one.

`STICK(<n>)` gives a direction — 0 for centred, then 1 to 8 clockwise from up,
so 1 is up, 3 right, 5 down and 7 left. `STICK(0)` reads the cursor keys,
`STICK(1)` and `STICK(2)` the two ports. `STRIG(<n>)` reads a trigger, `-1`
while it is held: `STRIG(0)` is the space bar, `STRIG(1)` and `STRIG(3)` the
first triggers of the two ports, and `STRIG(2)` and `STRIG(4)` their second
triggers.

Choosing **Controller** for the on-screen pad drives port 1, so a game written
against `STICK(1)` and `STRIG(1)` is pad-driven here and reads a real stick on
real hardware unchanged. The bundled games offer both, reading `STICK(0)` when
the player picks keyboard.

`PDL` and `PAD` read paddles and a touch pad on the same ports. Neither is
fitted here, so `PDL` reads 255 and `PAD` reads 0.

### Memory

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="hb10p" :map="hb10pMemoryMap" />

Two things about this layout are worth stating outright.

**Only the top half is RAM.** The MSX standard divides the address space into
four 16 KB pages and lets each be answered by a different cartridge slot. On this
machine the BIOS answers the first page and MSX BASIC the second, both from slot
0, and the 64 KB of RAM in slot 3 answers the two above them — so `0x8000` to
`0xFFFF` is the only RAM the processor can reach while BASIC is running. A byte
written below `0x8000` goes into RAM the processor never selects and reads back
as ROM.

**The screen is not in the map at all.** The picture is in the video chip's
separate 16 KB, reached only through `VPOKE`, `VPEEK` and the chip's two ports —
so a reader who assumes one address space would misread every screen `POKE` this
machine's BASIC does.

An MSX program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program before it runs. A block may sit
anywhere from `0x8000` to `0xF09F`; new blocks default to `0xE000`, which is
clear of any plausible program area. Everything from `0xF0A0` up is refused
outright rather than warned about: that is the string space, the file buffers
and the MSX system variable area, and the interpreter's stack descends through
the top of it. The on-machine equivalent of reserving that room is
`CLEAR 200,&HDFFF`, which lowers the top of memory before the program runs. The
block editor accepts an address either way round, as `0xE000` or as `57344`.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links —
no MSX export format carries them, because both `SAVE` and `CSAVE` write the
program area and nothing else. On Run the IDE refuses to start if a block would
overlap the BASIC program.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).
