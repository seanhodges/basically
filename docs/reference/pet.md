---
title: Commodore PET BASIC 4.0 reference
---

<script setup>
import { petReference } from './data/pet';
</script>

# Commodore PET BASIC 4.0 reference

Every command, function and operator in Commodore BASIC 4.0, the BASIC built into
the Commodore PET's ROM.

## Notes and caveats

- BASIC 4.0 is the same core language as the [Commodore 64's](./commodore64)
  BASIC V2, extended with fifteen disk-handling commands (tagged **BASIC 4.0**
  below).
- The PET shares the C64's PETSCII character set, so the same
  [escape codes](./commodore64/escapes) apply — though the colour-control codes
  have no effect on the PET's monochrome display.

<ReferenceTable :data="petReference" />

The machine hardware — screen modes, colour, graphics, sound and memory — is on
the [hardware](./pet/hardware) page; the control codes and graphics bytes you
can embed in source are on the shared
[escape codes](./commodore64/escapes) page; the native file containers and
cassette encoding are on the shared
[file formats](./commodore64/formats) page.
