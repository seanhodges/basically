---
title: Exidy Standard BASIC escape codes
---

<script setup>
import { sorcererEscapes } from '../../../src/reference/escapes/sorcerer';
</script>

# Exidy Standard BASIC escape codes

Every escape that can be typed in Sorcerer source, and the byte it stores. This
machine has no named escapes at all: printable ASCII and the standard graphics
characters are themselves, and every other code is written in the raw `{0xNN}`
form. Escapes are recognised in string literals, `REM` comments and `DATA`
bodies; a `{` that is not a well-formed escape is the literal `0x7B` character,
which the Sorcerer really has. Filters can be prefilled with `?q=` and `?cat=`
query parameters.

See also the [Exidy Standard BASIC reference](../sorcerer) and
[file formats](../file-formats#escape-notation).

## Printing one is not drawing one

A code below `0x20` means two different things depending on how it reaches the
screen, and the table below says both.

**Printed**, it is a control code. The Monitor's screen driver acts on nine of
them — the screen clear, a carriage return, a line feed and five cursor moves —
and silently discards the other twenty-three, so `PRINT CHR$(4)` puts nothing
on the screen and moves nothing.

**Poked into screen RAM**, it is a picture. All thirty-two have bitmaps in the
character generator ROM: outlined boxes and circles with various infills, short
diagonals, a pair of arrows and a question mark. `POKE -3968, 4` draws the
fourth of them in the top-left cell.

That is why the descriptions below give a shape first and, where there is one,
the printed effect second.

<EscapeTable :data="sorcererEscapes" />
