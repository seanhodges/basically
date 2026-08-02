---
title: Commodore BASIC reference
---

<script setup>
import { commodoreReference } from '../../src/reference/commodore';
</script>

# Commodore BASIC reference

Every command, function and operator in Commodore BASIC — BASIC V2 as built into
the ROMs of the Commodore 64 and VIC-20, and BASIC 4.0 as built into the
Commodore PET.

**In this reference:** [Hardware](./commodore/hardware) · [Escape codes](./commodore/escapes) · [File formats](./commodore/formats)

## Notes and caveats

- BASIC V2 is token-identical across the C64 and VIC-20 — same ROM tokens, same
  `LIST` spellings — so only their hardware (screen size, colours, sound, memory
  map) differs, as described on the [hardware](./commodore/hardware) page.
- BASIC 4.0 (the PET) is the same core language plus fifteen disk-handling
  commands. Keywords tagged **BASIC 4.0** are those extra disk commands; the C64
  and VIC-20 run the V2 core without them.
- The [PETSCII escape codes](./commodore/escapes) sub-page covers all three
  machines, though the colour-control codes have no visible effect on the PET's
  monochrome display.

<ReferenceTable :data="commodoreReference" />
