---
title: ZX Spectrum BASIC reference
---

<script setup>
import { zxspectrumReference } from '../../src/reference/zxspectrum';
</script>

# ZX Spectrum BASIC reference

Every command, function and operator in Sinclair ZX Spectrum BASIC.

**In this reference:** [Hardware](./zxspectrum/hardware) · [Escape codes](./zxspectrum/escapes) · [File formats](./zxspectrum/formats)

## Notes and caveats

- Keywords tagged **128K only** are available solely on the 128K models.
- Colour, sound and graphics statements drive the hardware described on the
  [hardware](./zxspectrum/hardware) page — including the Spectrum's per-cell
  colour attributes and their famous clash.

<ReferenceTable :data="zxspectrumReference" />
