---
title: Apple I escape codes
---

<script setup>
import { apple1Escapes } from '../../../src/reference/escapes/apple1';
</script>

# Apple I escape codes

Every escape that can be typed in Apple I source, and the byte it stores. The
character generator holds 64 shapes — ASCII `0x20`–`0x5F`, which this machine
carries with bit 7 set, so `0xA0`–`0xDF` are the printable codes — and every one
of the other 192 bytes is written as a `{0xNN}` raw-byte escape. There are no
named escapes at all: no colour, no cursor controls and no graphics characters.
Escapes are recognised in string literals and in `REM`, and because `{` and `}`
are not characters this machine has, an escape is the only way either reaches a
program. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Apple 1 Integer BASIC reference](../apple1) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="apple1Escapes" />
