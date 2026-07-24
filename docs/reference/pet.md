---
title: Commodore BASIC 4.0 reference
---

<script setup>
import { petReference } from './data/pet';
</script>

# Commodore BASIC 4.0 reference

Every command, function and operator in Commodore BASIC 4.0, the BASIC built into
the Commodore PET's ROM.

**In this reference:** [Hardware](./pet/hardware) · [Escape codes](./commodore64/escapes) · [File formats](./commodore64/formats)

## Notes and caveats

- BASIC 4.0 is the same core language as the [Commodore 64's](./commodore64)
  BASIC V2, extended with fifteen disk-handling commands (tagged **BASIC 4.0**
  below).
- The PET shares the C64's PETSCII character set, so the same
  [escape codes](./commodore64/escapes) apply — though the colour-control codes
  have no effect on the PET's monochrome display.

<ReferenceTable :data="petReference" />
