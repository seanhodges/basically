---
title: TRS-80 Level II BASIC reference
---

<script setup>
import { trs80Reference } from './data/trs80';
</script>

# TRS-80 Level II BASIC reference

Every command, function and operator in TRS-80 Level II BASIC.

**In this reference:** [Hardware](./trs80/hardware) · [Escape codes](./trs80/escapes) · [File formats](./trs80/formats)

## Notes and caveats

- Multiple statements per line are allowed with `:`; `?` is shorthand for
  `PRINT` and `'` for `REM`.
- Variable names may be any length but only the first two characters are
  significant, with `$` (string), `%` (integer), `!` (single) and `#` (double)
  type suffixes; `DEFSTR`/`DEFINT`/`DEFSNG`/`DEFDBL` set the default type per
  initial letter.

<ReferenceTable :data="trs80Reference" />
