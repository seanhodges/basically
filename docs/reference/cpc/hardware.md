---
title: Amstrad CPC hardware
---

<script setup>
import { cpc464MemoryMap } from '../../../src/dialects/cpc464/memoryMap';
import { cpc664MemoryMap } from '../../../src/dialects/cpc664/memoryMap';
import { cpc6128MemoryMap } from '../../../src/dialects/cpc6128/memoryMap';
</script>

# Amstrad CPC hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Locomotive BASIC](../cpc), and where machine-code and data blocks
live in its memory.

## Amstrad CPC 464

### Screen modes

Pick a mode with `MODE`:

| Mode     | Text       | Graphics  | Inks |
| -------- | ---------- | --------- | ---- |
| `MODE 0` | 20 columns | 160 × 200 | 16   |
| `MODE 1` | 40 columns | 320 × 200 | 4    |
| `MODE 2` | 80 columns | 640 × 200 | 2    |

All three render into one display; graphics always use a 640 × 400 coordinate
space with the origin at the bottom-left, moved with `ORIGIN`.

### Colour

The CPC has **27 hardware colours** (0–26). `INK <pen>, <colour>` assigns one of them
to a pen; a second colour (`INK <pen>, <colour>, <colour>`) flashes between the
two. `PEN` selects
the text ink, `PAPER` the text background and `BORDER` the surround.

### Graphics

`PLOT <x>, <y>[, <pen>]` lights a point, `DRAW <x>, <y>[, <pen>]` draws a line from the last
position, and `MOVE`/`DRAWR`/`MOVER` reposition or draw relatively. In BASIC 1.0
the plotting ink is the optional third argument to `PLOT`/`DRAW` (the `GRAPHICS
PEN`/`GRAPHICS PAPER` statements are BASIC 1.1 only and are not available on the
464).

### Sound

`SOUND <channel>, <period>[, <duration>[, <volume>[, <volenv>[, <toneenv>[, <noise>]]]]]` plays a tone;
`period` is `62500 / frequency`. `ENV` and `ENT` define volume and tone
envelopes.

### Memory {#cpc464-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="cpc464" :map="cpc464MemoryMap" />

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
[project bundle](../file-formats#project-bundle-zip) and through share links. On
Run the IDE refuses to start if a block would overlap the BASIC program, and
warns (but allows) a block over reserved workspace or the screen. See the
[machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[Z80 assembly reference](../z80-assembly).

## Amstrad CPC 664

The 664 is the 464 with a later BASIC and a disc drive in place of the tape
deck. Its memory, screen modes, colours, graphics coordinate space and sound
hardware are identical to the [464's](#amstrad-cpc-464) — everything above
applies unchanged.

### Locomotive BASIC 1.1 {#basic-11}

The 664 is where BASIC 1.1 first shipped. It adds eleven keywords to BASIC 1.0,
marked **BASIC 1.1 only** in the [keyword reference](../cpc); the most useful in
practice are:

| Keyword                           | What it does                                             |
| --------------------------------- | -------------------------------------------------------- |
| `FRAME`                           | Waits for display flyback, so animation stops flickering |
| `GRAPHICS PEN` / `GRAPHICS PAPER` | Set the plotting inks once instead of per `PLOT`/`DRAW`  |
| `FILL`                            | Flood-fills the area around the graphics cursor          |
| `MASK`                            | Sets the dot pattern lines are drawn with                |
| `COPYCHR$`                        | Reads back the character under the text cursor           |
| `CURSOR`                          | Shows or hides the text cursor                           |
| `DEC$`                            | Formats a number to a template                           |
| `CLEAR INPUT`                     | Discards pending keypresses                              |
| `ON BREAK CONT`                   | Makes <kbd>ESC</kbd> ignored                             |
| `DERR`                            | The last disc error number                               |

A program written in BASIC 1.0 runs on all three CPCs and builds the same program
bytes on each; one using the keywords above runs on the 664 and the 6128 but not
the 464.

### Tape, not disc {#cpc664-tape}

The real 664 has a 3" disc drive built in. This IDE runs the machine with **tape
only** — there is no disc drive and no AMSDOS ROM. Because AMSDOS is absent so
are its commands: `|DISC`, `|DIR`, `|ERA` and `|REN` are not available, and
neither is `|TAPE` — there is no disc filing system to switch away from, so the
cassette is already in use and `|TAPE` would answer `Unknown command`. `.dsk`
images are neither imported nor exported, and the machine reports the 464's
free-RAM figure rather than the smaller one a disc-equipped 664 leaves.

Data files work regardless of the missing drive, exactly as they do on the
[6128](#cpc6128-tape).

### Memory {#cpc664-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="cpc664" :map="cpc664MemoryMap" />

Memory blocks work exactly as on the [464](#cpc464-memory), with the same valid
range, the same **&8000** default and the same three warned regions.

## Amstrad CPC 6128

The 6128 is the 664 with more memory. Its screen modes, colours, graphics
coordinate space and sound hardware are identical to the
[464's](#amstrad-cpc-464), and it runs the same
[Locomotive BASIC 1.1](#basic-11) as the 664 — everything above applies
unchanged.

### The second 64K

The 6128 has 128K of RAM, but BASIC works in the same 64K as a 464: `HIMEM` is
the same `&AB7F` and `PRINT FRE(0)` reports the same free RAM. The extra 64K is
four 16K banks that the hardware windows _over_ the addresses BASIC already uses,
selected with `OUT &7F00,&C0+n` for one of eight configurations — it is for
machine code, not for BASIC variables or arrays. Configuration 0 is the flat base
64K the machine boots into; configuration 2 maps all four expansion banks at
once. The display always reads the base 64K whatever is selected, so banking
never disturbs the screen.

### Tape, not disc {#cpc6128-tape}

The real 6128 has a 3" disc drive, and boots addressing it. This IDE runs the
machine with **tape only** — there is no disc drive and no AMSDOS ROM. Because
AMSDOS is absent so are its commands: `|DIR`, `|ERA` and `|REN` are not
available, and neither is `|TAPE` — there is no disc filing system to switch
away from, so the cassette is already in use and `|TAPE` would answer `Unknown
command`. `.dsk` images are neither imported nor exported, and the machine
reports the 464's free-RAM figure rather than the 42,249 bytes a disc-equipped
6128 leaves.

Data files work regardless of the missing drive. A program that writes with
`OPENOUT` and `PRINT #9` and reads back with `OPENIN` and `INPUT #9` is served
by the IDE, which keeps what it saves and shows it alongside the program — see
[file formats](./formats). `LOAD`, `RUN"` and `CHAIN` read from the same place
when the name is one a program saved; `SAVE` and `CAT` still address the
cassette itself.

### Memory {#cpc6128-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="cpc6128" :map="cpc6128MemoryMap" />

Memory blocks work exactly as on the [464](#cpc464-memory), with the same valid
range, the same **&8000** default and the same three warned regions — blocks live
in the base 64K, which is what `CALL` and the assembler address.
