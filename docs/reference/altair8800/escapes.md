---
title: Altair 8800 escape codes
---

<script setup>
import { altair8800Escapes } from '../../../src/reference/escapes/altair8800';
</script>

# Altair 8800 escape codes

Every escape that can be typed in Altair 8800 source, and the byte it stores. Escapes are recognised in string literals, REM comments and DATA bodies. This is the shortest such table in the IDE, because the machine has the simplest character set: printable ASCII is itself, and every other byte is written in the raw `{0xNN}` form. There are no named escapes at all — no colour codes, no cursor controls and no block graphics — because there is no display to control. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Altair 8K BASIC reference](../altair8800) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="altair8800Escapes" />
