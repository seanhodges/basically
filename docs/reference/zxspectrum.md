---
title: ZX Spectrum BASIC reference
---

<script setup>
import { zxspectrumReference } from '../../src/reference/zxspectrum';
</script>

# ZX Spectrum BASIC reference

Every command, function and operator in Sinclair ZX Spectrum BASIC.

**In this reference:** [Hardware](./zxspectrum/hardware) · [Escape codes](./zxspectrum/escapes) · [File formats](./zxspectrum/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- Keywords tagged **128K only** are available solely on the 128K models.
- Colour, sound and graphics statements drive the hardware described on the
  [hardware](./zxspectrum/hardware) page — including the Spectrum's per-cell
  colour attributes and their famous clash.
- The power operator is `↑`, typed with the caret key and shown as an up arrow.
  It folds left to right, so `2↑3↑2` is `64`.
- `AND`, `OR` and `NOT` are not bitwise. `a AND b` is `a` when `b` is non-zero
  and `0` otherwise, and `a OR b` is `1` when `b` is non-zero and `a` otherwise,
  so `5 AND 3` is `5` here and `1` on a Commodore. A true comparison is `1`, not
  `-1`, which is what stops `X=X+(A>B)` counting the way it does elsewhere.

<ReferenceTable :data="zxspectrumReference" />
