---
title: BBC BASIC reference
---

<script setup>
import { bbcReference } from './data/bbc';
</script>

# BBC BASIC reference

Every command, function and operator in BBC BASIC, shared by the BBC Micro and
the BBC Master.

## Notes and caveats

- BBC BASIC also uses the symbolic memory operators `?` (byte) and `!` (word)
  and the string indirection `$`, plus the `@%` print-format variable. These
  are operators rather than keyword tokens, so they are not listed in the
  table below.

<ReferenceTable :data="bbcReference" />

The machine hardware — screen modes, colour, graphics, sound and memory — is on
the [hardware](./bbc/hardware) page; the control codes and graphics bytes you
can embed in source are on the [escape codes](./bbc/escapes) page; the native
file containers and cassette encoding are on the
[file formats](./bbc/formats) page.
