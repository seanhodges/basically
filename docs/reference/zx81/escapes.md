---
title: ZX81 escape codes
---

<script setup>
import { zx81Escapes } from '../data/escapes/zx81';
</script>

# ZX81 escape codes

Every escape that can be typed in ZX81 source, and the byte it stores. The ZX81 charset applies everywhere in a line - block-graphics escapes, `%c` inverse video and raw `\{NN}` bytes work in strings, REM bodies and expressions alike. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [ZX81 BASIC reference](../zx81) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="zx81Escapes" />
