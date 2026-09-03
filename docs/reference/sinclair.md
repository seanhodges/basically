---
title: Sinclair BASIC reference
---

<script setup>
import { sinclairReference } from '../../src/reference/sinclair';
</script>

# Sinclair BASIC reference

Every command, function and operator in Sinclair BASIC — **ZX81 BASIC** on the
1981 machine, and **48K** and **128 Sinclair BASIC** on the Spectrums that
followed it.

The three machines share an ancestry and about half a vocabulary. Rows only the
ZX81 has are badged **ZX81 only**, rows only the Spectrums have **Spectrum
only**, and the two the 128 alone has keep their **128K only** badge. Where all
three have a row and behave differently — `PLOT`, `THEN`, `CLEAR`, `INPUT`,
`SAVE`, `USR` — the row says how.

**In this reference:** [Hardware](./sinclair/hardware) · [Escape codes](./sinclair/escapes) · [File formats](./sinclair/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

### Shared by all three

- Variable names are single letters (`A`–`Z`, with a `$` suffix for strings) for
  arrays and strings; the Spectrums allow longer names for simple numeric
  variables.
- Keywords are entered as whole words and stored as single-byte tokens; the
  character set has no lower case for keywords, and `LET` is required on every
  assignment.
- `AND`, `OR` and `NOT` are not bitwise. `a AND b` is `a` when `b` is non-zero
  and `0` otherwise, and `a OR b` is `1` when `b` is non-zero and `a` otherwise,
  so `5 AND 3` is `5` here and `1` on a Commodore. A true comparison is `1`, not
  `-1`, which is what stops `X=X+(A>B)` counting the way it does elsewhere.
- The power operator folds left to right, so `2` to the `3` to the `2` is `64`.

### On the ZX81

- One numbered statement per line; line numbers run 1–9999 and must be strictly
  ascending. There are no multi-statement lines and no `ELSE`.
- The power operator is `**`.
- Graphics are the 64×44 grid of quarter-block pixels `PLOT` and `UNPLOT` set
  and clear. There is no colour and no sound.
- Machine code is kept in a `REM` line; `USR` takes an address and nothing else.

### On the Spectrums

- Keywords tagged **128K only** are available solely on the 128K models.
- The jumps are written `GO TO` and `GO SUB`, with a space, and `CONT` is
  `CONTINUE`. Everything after `THEN` on a line — including further
  `:`-separated statements — is conditional.
- Colour, sound and graphics statements drive the hardware described on the
  [hardware](./sinclair/hardware) page — including the Spectrum's per-cell
  colour attributes and their famous clash.
- The power operator is `↑`, typed with the caret key and shown as an up arrow.
- Machine code lives in a separate `CODE` block rather than in a `REM` line, and
  `USR` also takes a single-letter string, giving that user-defined graphic's
  address.

<ReferenceTable :data="sinclairReference" />
