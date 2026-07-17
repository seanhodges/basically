---
title: ZX Spectrum BASIC reference
---

<script setup>
import { zxspectrumReference } from './data/zxspectrum';
</script>

# ZX Spectrum BASIC reference

Every command, function and operator in Sinclair ZX Spectrum BASIC. Keywords
tagged **128K only** are available solely on the 128K models.

<ReferenceTable :data="zxspectrumReference" />

## Machine code & data blocks

A ZX Spectrum program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program and are in place before
it runs. A block may sit anywhere in the RAM above the ROM, from **0x4000 to
0xFFFF**; new blocks default to **0x8000**, clear of a typical program and its
variables. This holds for both the 48K and 128K models.

Two regions are flagged with a warning rather than refused: the display file and
colour attributes at **0x4000–0x5AFF**, and the system-variable area just above
it. A block there loads, but the running machine may overwrite it.

When a block sits below the default RAMTOP, the IDE runs a `CLEAR` for the byte
just below the block before it starts the program, so the BASIC stack can't grow
up over your code — poke a routine at 32768 and the IDE issues `CLEAR 32767`
first.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-bproj) and through share links.
They can also arrive on **import**: a `.TAP` containing CODE files brings each
CODE file in as a block. A tape that uses a tiny loader to chain into a larger
program is recognised — the loader is skipped (with a note) and the real program
imported. On Run the IDE refuses to start if a block would overlap the BASIC
program, and warns (but allows) a block over reserved hardware.

For a worked example, poke the five bytes `3E 02 D3 FE C9` (`LD A,2 : OUT
(0xFE),A : RET`) at 32768 and add `10 RANDOMIZE USR 32768`: running it turns the
border red. See the [machine code guide](../guide/machine-code) for the full
how-to and [Machine code & data blocks](./file-formats#machine-code-data-blocks)
for the cross-dialect overview.
