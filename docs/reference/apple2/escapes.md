---
title: Apple II escape codes
---

<script setup>
import { apple2Escapes } from '../../../src/reference/escapes/apple2';
</script>

# Apple II escape codes

Every escape that can be typed in Apple II source, and the byte it stores. The
character generator holds 64 shapes — ASCII `0x20`–`0x5F`, which this machine
carries with bit 7 set, so `0xA0`–`0xDF` are the printable codes — and the top
two bits of a screen byte pick the video mode that shape is drawn in rather than
picking another shape. So there are two named escapes, `{INV<c>}` and
`{FLASH<c>}`, for the inverse and flashing forms of any character, and a
`{0xNN}` raw-byte escape for everything else. Escapes are recognised in string
literals and in `REM`, and because `{` and `}` are not characters this machine
has, an escape is the only way either reaches a program. Inside a program line
only the codes with bit 7 set can be written: below `0x80` a byte is a token
there, so the inverse and flashing forms are `POKE`d to the text page or carried
in a data block instead. Filters can be prefilled with `?q=` and `?cat=` query
parameters.

See also the [Apple II Integer BASIC reference](../apple2) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="apple2Escapes" />
