---
title: Amstrad CPC Locomotive BASIC reference
---

<script setup>
import { cpcReference } from './data/cpc';
</script>

# Amstrad CPC Locomotive BASIC reference

The **Amstrad CPC 464** runs **Locomotive BASIC 1.0** on a 4 MHz Z80. It is a
full-featured Microsoft-era BASIC with real structured keywords — `IF … THEN …
ELSE`, `WHILE … WEND`, `GOSUB`, and the `AFTER`/`EVERY` interrupt timers — plus
the CPC's colour graphics and three-channel sound.

## Screen modes

Pick a mode with `MODE`:

| Mode     | Text       | Graphics  | Inks |
| -------- | ---------- | --------- | ---- |
| `MODE 0` | 20 columns | 160 × 200 | 16   |
| `MODE 1` | 40 columns | 320 × 200 | 4    |
| `MODE 2` | 80 columns | 640 × 200 | 2    |

All three render into one display; graphics always use a 640 × 400 coordinate
space with the origin at the bottom-left, moved with `ORIGIN`.

## Colour

The CPC has **27 hardware colours** (0–26). `INK p,c` assigns colour `c` to pen
`p`; a second argument (`INK p,c1,c2`) flashes between two colours. `PEN` selects
the text ink, `PAPER` the text background and `BORDER` the surround.

## Graphics

`PLOT x,y[,pen]` lights a point, `DRAW x,y[,pen]` draws a line from the last
position, and `MOVE`/`DRAWR`/`MOVER` reposition or draw relatively. In BASIC 1.0
the plotting ink is the optional third argument to `PLOT`/`DRAW` (the `GRAPHICS
PEN`/`GRAPHICS PAPER` statements are BASIC 1.1 only and are not available on the
464).

## Sound

`SOUND channel,period,duration[,volume[,volenv[,toneenv[,noise]]]]` plays a tone;
`period` is `62500 / frequency`. `ENV` and `ENT` define volume and tone
envelopes.

## Language notes

- Line numbers 1–65535, strictly ascending; multiple statements per line with
  `:`. `?` is shorthand for `PRINT`, `'` for `REM`, and `LET` is optional.
- Variable names are up to 40 characters, all significant, with `$` (string),
  `%` (integer) and `!` (real) type suffixes.
- Numbers may be written in decimal, hex (`&7F00`) or binary (`&X1010`);
  operators include `^` (power), `\` (integer divide) and `MOD`.
- Read the keyboard in games with `INKEY(n)` — it returns `-1` while a key is up.
  The cursor keys are `INKEY(0)` up, `INKEY(2)` down, `INKEY(8)` left and
  `INKEY(1)` right. `JOY(0)` returns the joystick as a bit mask (bit 0 up, 1
  down, 2 left, 3 right, 4 fire 2, 5 fire 1).

## Every keyword

The full command, function and operator set. Entries tagged **BASIC 1.1 only**
are the additions Locomotive BASIC 1.1 (the CPC 6128) brings; the BASIC 1.0 464
rejects them.

<ReferenceTable :data="cpcReference" />

The control codes and graphics/symbol bytes you can embed in strings are on the
[escape codes](./cpc/escapes) page; the native `.bas`/`.cdt`/cassette containers
are on the [file formats](./cpc/formats) page.

## Machine code & data blocks

A CPC program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program and are in place before it runs.
The CPC is a flat 64K of RAM (the firmware and BASIC ROMs are read overlays
only), so a block may sit almost anywhere from **&0040 to &FFFF**; new blocks
default to **&8000**, below the default `HIMEM` (&AB7F) and clear of a typical
program. Reserve room on real hardware with `MEMORY &7FFF` before loading code
that high.

Three regions are flagged with a warning rather than refused: the firmware and
BASIC workspace below the program (**&0040–&016F**), the high BASIC workspace and
firmware jumpblocks above HIMEM (**&AB80–&BFFF**), and the screen memory
(**&C000–&FFFF**). A block there loads, but the running machine may overwrite it.
`CALL address` runs a block from BASIC.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-zip) and through share links. On
Run the IDE refuses to start if a block would overlap the BASIC program, and
warns (but allows) a block over reserved workspace or the screen. See the
[machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](./z80-assembly).

> Locomotive BASIC 1.1 (as shipped on the CPC 6128) adds `FILL`, `FRAME`,
> `GRAPHICS PEN`/`PAPER`, `MASK`, `DERR` and more; those keywords are rejected on
> the BASIC 1.0 464 and are tagged **BASIC 1.1 only** in the table above.
