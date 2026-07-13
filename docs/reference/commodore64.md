---
title: Commodore 64 & VIC-20 BASIC reference
---

<script setup>
import { commodore64Reference } from './data/commodore64';
</script>

# Commodore 64 & VIC-20 BASIC reference

Every command, function and operator in Commodore BASIC V2, the BASIC built into
the ROMs of both the Commodore 64 and the VIC-20. BASIC V2 is
token-identical across the two machines — same ROM tokens, same `LIST`
spellings — so this one page is the reference for both; only the machine
hardware (screen size, colours, sound, memory map) differs. The
[Commodore PET](./pet) runs the same core language plus fifteen extra disk
commands, listed on its own page.

The [PETSCII escape codes](./commodore64/escapes) sub-page covers all three
machines.

<ReferenceTable :data="commodore64Reference" />
