---
title: ZX80 escape codes
---

<script setup>
import { zx80Escapes } from '../data/escapes/zx80';
</script>

# ZX80 escape codes

Every escape that can be typed in ZX80 source, and the byte it stores. The spellings match the ZX81's, remapped to the ZX80's own character codes, and apply everywhere in a line. Inside a string, `""` stores the quote-image code 0x81. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [ZX80 BASIC reference](../zx80) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="zx80Escapes" />
