---
title: BBC BASIC reference
---

<script setup>
import { bbcReference } from './data/bbc';
</script>

# BBC BASIC reference

Every command, function and operator in BBC BASIC, shared by the BBC Micro and
the BBC Master.

> **Note.** BBC BASIC also uses the symbolic memory operators `?` (byte) and `!`
> (word) and the string indirection `$`, plus the `@%` print-format variable.
> These are operators rather than keyword tokens, so they are not listed in the
> table below.

<ReferenceTable :data="bbcReference" />

## Machine code & data blocks

A BBC program can load fixed-address machine code or data — **memory blocks** —
into RAM alongside the BASIC program before it runs. A block may live from PAGE
(the BASIC program start) up to **0x7FFF**. PAGE differs by model: it is
**0x1900** on the Micro, where the disc filing system's workspace pushes it up,
and **0x0E00** on the Master, whose filing systems live in private RAM. New
blocks default to **0x2E00**, above a small program.

In graphics modes the screen fills **0x3000–0x7FFF** (only 0x7C00 and up in MODE
7), so that whole band is reserved with a warning: a block there is allowed but
may be overwritten the moment the program selects a graphics mode.

The `.bbc` file holds only the BASIC program, so blocks travel inside the
[`.ssd`](./bbc/formats#bbc-micro-master-ssd) disc image instead: export a
`.ssd` to carry the program together with each block (at its own load/exec
address), and importing one brings them all back. Blocks also travel with a BBC
document through the [project bundle](./file-formats#project-bundle-bproj) or a
share link. On Run the IDE refuses to start if a block would overlap the BASIC
program, and warns (but allows) a block over the screen.

See the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
