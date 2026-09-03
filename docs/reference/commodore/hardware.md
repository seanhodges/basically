---
title: Commodore 64, VIC-20 & PET hardware
---

<script setup>
import { c64MemoryMap } from '../../../src/dialects/commodore64/memoryMap';
import { vic20MemoryMap } from '../../../src/dialects/vic20/memoryMap';
import { petMemoryMap } from '../../../src/dialects/pet/memoryMap';
</script>

# Commodore 64, VIC-20 & PET hardware

The screen, colour, graphics and sound hardware of each machine that runs
[Commodore BASIC](../commodore), and where machine-code and data blocks live in
its memory.

## Commodore 64

### Screen modes {#c64-screen-modes}

The C64 boots into its single BASIC screen: 40×25 characters. The VIC-II video
chip also offers a 320×200 hires bitmap, a 160×200 multicolour mode and eight
hardware sprites, but BASIC V2 has no keywords for them — they are reached by
POKEing the VIC-II registers at 53248 ($D000).

### Colour {#c64-colour}

Sixteen colours. The border and background are set by POKEing 53280 and 53281,
and each character cell has its own foreground colour in the colour RAM at 55296. In `PRINT`, the PETSCII colour-control codes (the `{red}`, `{cyan}`…
escapes on the [escape codes](./escapes) page) change the text colour inline.

### Graphics {#c64-graphics}

BASIC graphics are drawn with the PETSCII block-graphics characters — typed as
their Unicode glyphs or escapes (see [escape codes](./escapes)). Bitmap
graphics and sprites are VIC-II features driven by POKEs rather than keywords.

### Sound {#c64-sound}

The SID chip plays three independent voices, but BASIC V2 has no sound
keywords: music is made by POKEing the SID registers at 54272 ($D400), with the
master volume at 54296.

The SID here is a synthesised approximation, not a model of the 6581. Tones,
noise, the pulse width and the ADSR envelopes all play; four things do not. The
**filter is ignored** — the mode, cutoff and resonance at $D418 and $D415–$D417
change nothing, so a program that filters a bright waveform down to a soft one
just sounds bright. Ring modulation and hard sync are ignored. Setting more than
one waveform bit picks a single waveform by priority rather than AND-ing them as
the chip does. And the noise is a generic shift register, not the SID's own tap
layout, so it is the right character but not the same sound.

### Timing {#c64-timing}

The C64 here is a PAL machine: 312 raster lines of 63 processor cycles each,
just over 50 frames a second, on a 985 kHz 6510.

Those cycles are not all the program's. Every eighth line down the screen, the
VIC-II needs the next row of forty characters before it can draw them, and it
takes the bus away from the processor to fetch them — forty cycles at a time,
twenty-five times a frame. That is about a thousand cycles, five per cent of the
frame, that a program never gets. It is why a counting loop finishes a little
later than the clock speed alone suggests, and why a delay written as
`FOR I=1 TO N` is worth timing rather than calculating.

It also matters for raster effects — POKEing 53280 or 53281 in a timed loop to
draw coloured bands. Where those bands land depends on exactly how many cycles a
frame is worth, so a program written for a 60 Hz NTSC C64 (263 lines of 65
cycles) will not draw the pattern its author intended on this PAL one. The bands
appear, but they drift at a different rate.

### Memory {#c64-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="commodore64" :map="c64MemoryMap" />

A Commodore 64 program can load fixed-address machine code or data — **memory
blocks** — into RAM alongside the BASIC program, ready before it runs. A block
may live anywhere from **0x0800 to 0xFFFF** (BASIC itself starts at $0801); new
blocks default to **0xC000**. The I/O area at **0xD000–0xDFFF** is flagged with
a warning — a block there loads but sits under the VIC-II, SID and colour
registers.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links,
and can arrive on **import**: a `.prg` whose load address isn't the BASIC start
comes in as a single block at that address, and a normal `.prg` with extra bytes
past the end of the tokenized program brings those trailing bytes in as a block.

On Run the IDE refuses to start if a block would overlap the BASIC program, and
warns (but allows) a block over reserved hardware.

For a worked example, poke `A9 02 8D 20 D0 60` (`LDA #2 : STA $D020 : RTS`) at
49152 and add `10 SYS 49152`: running it turns the border red. See the
[machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).

## VIC-20

### Screen modes {#vic20-screen-modes}

The unexpanded VIC-20's screen is 22×23 characters, driven by the VIC chip.
There is no bitmap mode or sprite hardware.

### Colour {#vic20-colour}

Eight character colours, with the border and background chosen together from a
combined register — POKE 36879 sets the pair. The PETSCII colour-control
escapes work in `PRINT` as on the C64.

### Graphics {#vic20-graphics}

As on the C64, graphics are the PETSCII block-graphics characters (see
[escape codes](./escapes)).

### Sound {#vic20-sound}

The VIC chip has three square-wave voices plus a noise channel, POKEd at
36874–36877 with the volume at 36878 — BASIC V2 has no sound keywords here
either.

### Memory {#vic20-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="vic20" :map="vic20MemoryMap" />

On the unexpanded VIC-20 a block may live from **0x1000 to 0x1DFF**, with BASIC
starting at $1001; new blocks default to **0x1C00**. The screen at
**0x1E00–0x1FFF** is reserved with a warning. RAM expansions aren't modelled,
so the usable window is the bare 5K machine's. Import, export and run-time
checks follow the same rules as the [C64](#c64-memory).

## Commodore PET

### Screen modes {#pet-screen-modes}

The PET has a single 40×25 character screen on its built-in monochrome
monitor. The 1000-byte screen memory at 32768 ($8000) can be read and written
directly with `PEEK` and `POKE`.

### Colour {#pet-colour}

The PET has no colour hardware — the display is monochrome green on black. The
PETSCII colour-control escapes shared with the C64 store and round-trip
identically but have no visible effect (see the [escape codes](./escapes) page).

### Graphics {#pet-graphics}

Graphics are drawn with the PETSCII block-graphics characters — printed, or
POKEd straight into screen memory. There is no bitmap mode.

### Sound {#pet-sound}

The PET shipped without dedicated sound hardware (later models could drive a
small piezo speaker from the CB2 line), and BASIC 4.0 has no sound keywords.

### Memory {#pet-memory}

The whole of the machine's address space, region by region. Zoom in to open a
band into the parts it groups, and select a region for its addresses and what
sits there.

<MemoryMapSingle machine="pet" :map="petMemoryMap" />

A PET program can carry fixed-address machine code or data — **memory blocks** —
that load into RAM alongside the BASIC program before it runs. On the PET a block
may sit from **0x0400 to 0x7FFF** (BASIC text itself starts at $0401); new blocks
default to **0x7000**, high in RAM clear of a typical program.

Blocks travel with the document through the
[project bundle](../file-formats#project-bundle-zip) and through share links.
They can also arrive on **import**, using the same `.prg` rule as the
[C64 and VIC-20](#c64-memory): a `.prg` whose load address isn't the BASIC start
($0401) comes in as a block at that address, and a normal `.prg` with bytes past
the end of the tokenized program brings those trailing bytes in as a block.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[6502 assembly reference](../6502-assembly).
