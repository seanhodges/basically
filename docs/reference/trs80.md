---
title: TRS-80 Level II BASIC reference
---

<script setup>
import { trs80Reference } from './data/trs80';
</script>

# TRS-80 Level II BASIC reference

Every command, function and operator in TRS-80 Level II BASIC.

<ReferenceTable :data="trs80Reference" />

## Machine code & data blocks

A TRS-80 program can carry fixed-address machine code or data — **memory
blocks** — that load into RAM alongside the BASIC program before it runs. On the
TRS-80 a block may sit from **0x4000 to 0x7FFF**; new blocks default to
**0x7000**, high in RAM clear of a typical program.

Blocks travel with the document through the
[project bundle](./file-formats#project-bundle-bproj) and through share links,
and can arrive on **import**: a machine-language SYSTEM-format `.cas` brings each
of its address records in as a block. An ordinary BASIC `.cas` is unaffected.

On Run the IDE refuses to start if a block would overlap the BASIC program. See
the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
