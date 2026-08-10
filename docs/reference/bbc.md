---
title: BBC BASIC reference
---

<script setup>
import { bbcReference } from '../../src/reference/bbc';
</script>

# BBC BASIC reference

Every command, function and operator in BBC BASIC, shared by the BBC Micro and
the BBC Master.

**In this reference:** [Hardware](./bbc/hardware) · [Escape codes](./bbc/escapes) · [File formats](./bbc/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- BBC BASIC reaches memory through the indirection operators `?` (byte), `!`
  (word) and `$` (string) rather than `PEEK`/`POKE`; all three are in the table
  below. The `@%` print-format variable is a variable rather than an operator,
  so it is not.
- The power operator is `^`, and it folds left to right: `2^3^2` is `64`.
- `AND`, `OR`, `NOT` and `EOR` combine their operands bit by bit — `5 AND 3` is
  `1` — and a true comparison is `-1`. `DIV` and `MOD` are the integer division
  and remainder; the Atom that preceded this machine has neither, and answers
  `1` rather than `-1` to a true comparison.

<ReferenceTable :data="bbcReference" />
