---
title: BBC BASIC reference
---

<script setup>
import { bbcReference } from './data/bbc';
</script>

# BBC BASIC reference

Every command, function and operator in BBC BASIC, shared by the BBC Micro and
the BBC Master.

**In this reference:** [Hardware](./bbc/hardware) · [Escape codes](./bbc/escapes) · [File formats](./bbc/formats)

## Notes and caveats

- BBC BASIC also uses the symbolic memory operators `?` (byte) and `!` (word)
  and the string indirection `$`, plus the `@%` print-format variable.

<ReferenceTable :data="bbcReference" />
