---
title: Acorn Atom escape codes
---

<script setup>
import { atomEscapes } from '../data/escapes/atom';
</script>

# Acorn Atom escape codes

Every escape that can be typed in Atom source, and the byte it stores. The Atom stores lines as near-plain ASCII, so `{0xNN}` escapes are recognised everywhere in a line; a `{...}` that is not an escape is literal text. There is no `%c` inverse prefix because `%A`-`%Z` name the floating-point ROM's variables. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Acorn Atom BASIC reference](../atom) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="atomEscapes" />
