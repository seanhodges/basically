---
title: Commodore BASIC V2 reference
---

<script setup>
import { commodore64Reference } from './data/commodore64';
</script>

# Commodore BASIC V2 reference

Every command, function and operator in Commodore BASIC V2, the BASIC built into
the ROMs of both the Commodore 64 and the VIC-20.

**In this reference:** [Hardware](./commodore64/hardware) · [Escape codes](./commodore64/escapes) · [File formats](./commodore64/formats)

## Notes and caveats

- BASIC V2 is token-identical across the two machines — same ROM tokens, same
  `LIST` spellings — so this one page is the reference for both; only the
  machine hardware (screen size, colours, sound, memory map) differs, as
  described on the [hardware](./commodore64/hardware) page.
- The [Commodore PET](./pet) runs the same core language plus fifteen extra
  disk commands, listed on its own page.
- The [PETSCII escape codes](./commodore64/escapes) sub-page covers all three
  machines.

<ReferenceTable :data="commodore64Reference" />
