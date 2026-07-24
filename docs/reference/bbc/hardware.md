---
title: BBC hardware
---

# BBC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[BBC BASIC](../bbc), and where machine-code and data blocks live in its memory.

## BBC Micro

### Screen modes

Pick a mode with `MODE`; each clears the screen and resets the graphics state:

| Mode     | Text    | Graphics  | Colours  |
| -------- | ------- | --------- | -------- |
| `MODE 0` | 80 × 32 | 640 × 256 | 2        |
| `MODE 1` | 40 × 32 | 320 × 256 | 4        |
| `MODE 2` | 20 × 32 | 160 × 256 | 8        |
| `MODE 3` | 80 × 25 | text only | 2        |
| `MODE 4` | 40 × 32 | 320 × 256 | 2        |
| `MODE 5` | 20 × 32 | 160 × 256 | 4        |
| `MODE 6` | 40 × 25 | text only | 2        |
| `MODE 7` | 40 × 25 | teletext  | teletext |

MODE 7 is the teletext mode, driven by control bytes in the character stream
(the named teletext escapes on the [escape codes](./escapes) page).
Higher-resolution modes consume more RAM — in graphics modes the screen fills
0x3000–0x7FFF, but only 0x7C00 and up in MODE 7.

### Colour

Text and graphics use **logical colours**, chosen from eight actual colours
plus eight flashing pairs. `COLOUR n` sets the text colour (add 128 for the
text background); `GCOL mode,n` sets the graphics colour together with a plot
action (0 plot, 1 OR, 2 AND, 3 EOR, 4 invert). `VDU 19` remaps a logical
colour onto any actual colour.

### Graphics

All graphics modes share one logical coordinate space — 0–1279 by 0–1023 with
the origin at the bottom-left — regardless of the pixel resolution. `MOVE`
positions the graphics cursor, `DRAW` draws a line to a point, and `PLOT k,x,y`
is the general primitive whose first argument selects the action (line, point,
filled triangle and so on). `CLG` clears the graphics area to the graphics
background colour.

### Sound

`SOUND channel,amplitude,pitch,duration` plays a note on one of four channels —
channel 0 is noise, 1–3 are tone. The amplitude runs 0 to −15, or names one of
the four `ENVELOPE`s, each defined by 14 parameters shaping pitch and amplitude
over time.

### Memory

A BBC program can load fixed-address machine code or data — **memory blocks** —
into RAM alongside the BASIC program before it runs. A block may live from PAGE
(the BASIC program start) up to **0x7FFF**. On the Micro PAGE is **0x1900**,
where the disc filing system's workspace pushes it up. New blocks default to
**0x2E00**, above a small program.

In graphics modes the screen fills **0x3000–0x7FFF** (only 0x7C00 and up in MODE
7), so that whole band is reserved with a warning: a block there is allowed but
may be overwritten the moment the program selects a graphics mode.

The `.bbc` file holds only the BASIC program, so blocks travel inside the
[`.ssd`](./formats#bbc-micro-master-ssd) disc image instead: export a
`.ssd` to carry the program together with each block (at its own load/exec
address), and importing one brings them all back. Blocks also travel with a BBC
document through the [project bundle](../file-formats#project-bundle-zip) or a
share link. On Run the IDE refuses to start if a block would overlap the BASIC
program, and warns (but allows) a block over the screen.

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).

## BBC Master

### Screen modes

The Master offers the Micro's `MODE 0`–`7` and adds the shadow modes 128–135,
which keep the screen in separate shadow RAM so a program loses no main memory
to the display.

### Colour

As on the Micro; the Master's `COLOUR` can also redefine the palette directly.

### Graphics

Identical to the Micro — the same 1280 × 1024 logical coordinate space and
`MOVE`/`DRAW`/`PLOT` primitives.

### Sound

Identical to the Micro — the same four-channel `SOUND` and `ENVELOPE` system.

### Memory

As on the Micro, but PAGE is **0x0E00** — the Master's filing systems live in
private RAM, so BASIC programs (and blocks) get more room. The same block
window up to **0x7FFF**, screen warnings, `.ssd` export and run-time checks
described [above](#memory) apply.
