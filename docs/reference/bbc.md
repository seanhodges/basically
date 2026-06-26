---
title: BBC BASIC reference
---

<script setup>
import { bbcReference } from './data/bbc';
</script>

# BBC BASIC reference

Every command, function and operator in BBC BASIC, shared by the BBC Micro and
the BBC Master.

> **Note.** BBC BASIC also uses the symbolic memory operators `?` (byte) and `!`
> (word) and the string indirection `$`, plus the `@%` print-format variable.
> These are operators rather than keyword tokens, so they are not listed in the
> table below.

<ReferenceTable :data="bbcReference" />
