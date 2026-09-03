---
title: SAM Coupé hardware
---

<script setup>
import { samcoupeMemoryMap } from '../../../src/dialects/samcoupe/memoryMap';
</script>

# SAM Coupé hardware

The screen, colour, graphics and sound hardware of each machine that runs
[SAM BASIC](../samcoupe), and where machine-code and data blocks live in its
memory.

## SAM Coupé

### Screen modes

Pick a mode with `MODE`, which clears the screen as it changes it. The machine
boots in mode 4.

| Mode     | Pixels    | Colours                                    | Display file |
| -------- | --------- | ------------------------------------------ | ------------ |
| `MODE 1` | 256 × 192 | One ink/paper pair per 8 × 8 cell          | 6 KB         |
| `MODE 2` | 256 × 192 | One ink/paper pair per pixel row of a cell | 12 KB        |
| `MODE 3` | 512 × 192 | Four colours, chosen from the palette      | 24 KB        |
| `MODE 4` | 256 × 192 | Sixteen colours, any pixel                 | 24 KB        |

Mode 1 is the ZX Spectrum's screen, byte for byte — the same thirds-then-rows
bitmap order, the same 768 attributes, the same attribute clash. Mode 2 keeps
the resolution and gives every one of the 192 pixel rows its own attribute row,
so clash becomes horizontal only. Modes 3 and 4 have no attributes at all:
colour is per pixel, at two bits each across 512 pixels or four bits each
across 256. Anything outside 1 to 4 is `Invalid screen mode`.

`ATTR(<row>, <col>)` reads an attribute byte back, and is therefore a mode 1
reading; in any other mode it answers `Invalid screen mode`, there being nothing
to read.

**The text grid is not 32 × 24.** `CSIZE` sets the character cell and it boots
at eight pixels wide by **nine** scanlines tall, which makes the screen 32 × 21
with a blank scanline under every character. The bottom two rows are the lower
window, where reports and `INPUT` appear, so `PRINT AT` reaches rows 0 to 18 and
asking for 19 or 20 is `Off screen`. `CSIZE <width>, <height>` takes a width of
6 or 8 and a height of 6 to 32; anything else is `Integer out of range`. Mode 3
is the only mode whose pixels are not drawn at double width, so it is the only
one that fits 64 columns.

`WINDOW <left>, <right>, <top>, <bottom>` confines printing and scrolling to
part of the screen and bare `WINDOW` restores the whole of it. `CLS` clears the
screen; `CLS #` clears the current window only.

The machine has more than one screen. `OPEN SCREEN <n>, <mode>` makes another,
`SCREEN <n>` points printing and plotting at it and `DISPLAY <n>` shows one —
which need not be the one being drawn on, so a picture can be built out of sight
and then shown complete. Naming a screen that was never opened is
`Invalid screen number`.

The emulator's canvas is 512 × 192: mode 3's full raster, which every other mode
fits inside at two device pixels per pixel. The border is not drawn, as on the
Sinclair machines here.

### Colour

Sixteen colours on screen at once, from a palette of **128**, through a
sixteen-entry colour lookup table. `PALETTE <index>, <colour>` points one of the
sixteen slots at one of the 128 colours, so `PEN 5` means whatever slot 5 was
last told; a slot above 15 is `Invalid colour` and a colour above 127
`Invalid palette colour`.

The 128 colours are not a table but an arithmetic: each of red, green and blue
gets a three-bit level built from two bits of the colour number plus bit 3,
which contributes the least significant step to all three at once. That shared
half-step is why the palette reads as bright and dim versions of the same hues
rather than having a brightness control.

A reset leaves the lookup table holding the Spectrum's own sixteen, dim first
and bright above:

| Slot | Colour  | Slot | Colour         |
| ---- | ------- | ---- | -------------- |
| 0    | Black   | 8    | Black          |
| 1    | Blue    | 9    | Bright blue    |
| 2    | Red     | 10   | Bright red     |
| 3    | Magenta | 11   | Bright magenta |
| 4    | Green   | 12   | Bright green   |
| 5    | Cyan    | 13   | Bright cyan    |
| 6    | Yellow  | 14   | Bright yellow  |
| 7    | White   | 15   | Bright white   |

`PEN` sets the foreground colour (`INK` is accepted as a spelling of it and
lists back as `PEN`), `PAPER` the background and `BORDER` the surround, all as
slot numbers; a border above 15 is `Invalid colour`. `INVERSE` swaps pen and
paper as the characters are drawn and works in every mode, while `FLASH` and
`BRIGHT` are attribute bits and so work in mode 1 only — in mode 4 colour is per
pixel and there is nothing to flash. `OVER 1` combines what is drawn with what
is already there, so drawing the same shape twice erases it.

### Graphics

The origin is the **bottom left**, and the vertical range is the same in every
mode: `x` runs 0 to 255 (0 to 511 in mode 3) and `y` 0 to 173, the two rows of
the lower window not being plottable. Outside that is `Integer out of range`.

`PLOT <x>, <y>` plots a point and moves the graphics position to it. **`DRAW` is
relative**: `DRAW <dx>, <dy>` draws from the graphics position by a distance
rather than to a coordinate, so a line starts with a `PLOT`. A third argument
bends it into an arc turning through that many radians. `CIRCLE <x>, <y>, <r>`
and `FILL <x>, <y>` complete the set, and `POINT(<x>, <y>)` reads a pixel back
as a palette slot.

`GRAB <a$>, <x>, <y>, <w>, <h>` copies a rectangle of screen into a string and
`PUT <x>, <y>, <a$>` draws it back, optionally through a second string used as a
mask. This pair is how a SAM program animates a sprite; note that a qualifier
goes in front of the coordinates, as `PUT OVER 1; <x>, <y>, <a$>`.

`ROLL` and `SCROLL` shift the screen, or a rectangle of it, in one of four
directions — `ROLL` wrapping what falls off one edge round to the other,
`SCROLL` losing it. `BLITZ <a$>` runs a string of packed drawing commands in one
go, which is far quicker than the same figure drawn statement by statement.

### Sound

A **Philips SAA 1099**, not the AY-3-8912 of the Spectrum 128 and the Amstrads:
six tone generators in stereo over eight octaves, two noise generators, two
envelope generators and an amplitude control per channel, clocked at a flat
8 MHz. A tone's frequency is `15625 × 2^octave / (511 − freq)`.

`BEEP <duration>, <pitch>` sounds one note, a length in seconds at a pitch in
semitones from middle C, exactly as the Spectrum's does. `ZAP`, `POW`, `BOOM`
and `ZOOM` are built-in effects and take no arguments.

`SOUND <register>, <value>` writes a chip register directly, 0 to 31 — anything
above is `Integer out of range`. It is **not** a note, and it is the only way to
reach the noise generators, the envelopes and the stereo:

| Registers  | What they hold                                            |
| ---------- | --------------------------------------------------------- |
| `0`–`5`    | Amplitude per channel: low nibble left, high nibble right |
| `8`–`13`   | Frequency, eight bits, one register per channel           |
| `16`–`18`  | Octave, one channel per nibble (0–7)                      |
| `20`       | Tone enable, one bit per channel                          |
| `21`       | Noise enable, one bit per channel                         |
| `22`       | Noise generator clock                                     |
| `24`, `25` | Envelope control for channels 2 and 5                     |
| `28`       | Bit 0 enables all sound; bit 1 holds the generators reset |

The IDE sums the two stereo halves to mono, because its audio path takes one
stream and six channels being audible matters more here than the image: a voice
panned hard left still sounds, at half amplitude.

### Timing

The SAM's Z80 runs at 6 MHz, nearly twice a Spectrum's 3.5 MHz, which is most
of why SAM BASIC feels faster than the machine it resembles.

Memory contention is **not modelled**. On the real machine the ASIC takes cycles
off the processor while it fetches the picture, in a pattern that depends on the
screen mode — mode 4 costing most — so a routine's real speed varies with where
it runs and what is on screen. Here every access costs the same, and a routine
timed against a raster on real hardware runs faster and more evenly than it
would. Nothing measured in whole frames is affected.

### Joystick

One nine-pin port, and it is wired onto the key matrix rather than beside it —
left, right, down, up and fire are keys **6, 7, 8, 9 and 0**. So a loop testing
`INKEY$` for those characters answers the keyboard and the stick alike, which is
what the bundled games do; choosing **Controller** for the on-screen pad presses
exactly those keys. Use them for movement in preference to the cursor cluster.

A mouse and a light pen have their own readings — `XMOUSE`, `YMOUSE`, `BUTTON`,
`XPEN` and `YPEN` — but neither device is fitted here, so none of them moves.

### Memory

The whole of the address space SAM BASIC's own `PEEK`, `POKE`, `CALL` and `USR`
use, region by region. Zoom in to open a band into the parts it groups, and
select a region for its addresses and what sits there.

<MemoryMapSingle machine="samcoupe" :map="samcoupeMemoryMap" />

Two things about this layout are worth stating outright.

**The addresses run past `0xFFFF`.** The machine has 256 KB behind a 64 KB
window, so "which 64 KB" is a real question here, and the answer BASIC gives is
neither the processor's window nor the whole of RAM: it is ROM 0, then BASIC's
own four 16 KB pages one after another from `0x4000`, running on to `0x1FFFF`.
That is the space a typed `PEEK` addresses, it has one address per byte, and the
map above draws its first 64 KB. `RAMTOP` boots at the top of the fourth page,
so the program, its variables and its strings share 64 KB of the 256 — the rest
is reachable only through `MEM$`, the screen pages and a `POKE` above `0xFFFF`.
A cold machine reports `FREE` as 57545.

**The screen is not in the map.** The picture is fetched by the video chip
straight out of a RAM page, and which page is a register rather than an address,
so a routine that wants to draw has to page the screen in — and paging is what
decides where a code block can safely live.

A SAM Coupé program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. A
block may sit anywhere from `0x4000` to `0x7FFF`, and new blocks default to
`0x7000`. That range is the processor's section B, which is the half that stays
put: a routine that pages the screen in writes the high page register, which
swaps the top of the window out from under anything living there, while section
B is addressed off the low one and must not be touched, the ROM's own stack
being inside it. Everything below `0x5CD5` is refused rather than warned about —
the ROM's buffers and stack, then the system variables the interpreter reads on
every statement — and the band from there up is the BASIC program and the
variable areas that grow above it. The block editor accepts an address either
way round, as `0x7000` or as `28672`.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links.
The `.tap` export cannot carry them: a SAM `CODE` file names its destination as
a page number the ROM adds the saving machine's own paging to, so a block's
address is only meaningful beside the paging it was written under, and the
Transfer dialog says so before dropping them. On Run the IDE refuses to start if
a block would overlap the BASIC program.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).
