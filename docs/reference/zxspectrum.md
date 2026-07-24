---
title: ZX Spectrum BASIC reference
---

<script setup>
import { zxspectrumReference } from './data/zxspectrum';
</script>

# ZX Spectrum BASIC reference

Every command, function and operator in Sinclair ZX Spectrum BASIC.

## Notes and caveats

- Keywords tagged **128K only** are available solely on the 128K models.
- Colour, sound and graphics statements drive the hardware described on the
  [hardware](./zxspectrum/hardware) page — including the Spectrum's per-cell
  colour attributes and their famous clash.

<ReferenceTable :data="zxspectrumReference" />

The machine hardware — screen modes, colour, graphics, sound and memory — is on
the [hardware](./zxspectrum/hardware) page; the control codes and graphics
bytes you can embed in source are on the
[escape codes](./zxspectrum/escapes) page; the native file containers and
cassette encoding are on the [file formats](./zxspectrum/formats) page.
