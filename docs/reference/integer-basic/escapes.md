---
title: Integer BASIC escape codes
---

<script setup>
import { integerBasicEscapes } from '../../../src/reference/escapes/integer-basic';
</script>

# Integer BASIC escape codes

Every escape that can be typed in Apple I or Apple II source, and the byte it
stores. The two machines share a BASIC and not a character generator, so each
row here is badged with the machine it belongs to, and only the `{0xNN}`
raw-byte escape is common to both. Escapes are recognised in string literals and
in `REM`, and because `{` and `}` are not characters either machine has, an
escape is the only way either reaches a program. Filters can be prefilled with
`?q=` and `?cat=` query parameters.

## On the Apple I

The character generator holds 64 shapes — ASCII `0x20`–`0x5F`, which this
machine carries with bit 7 set, so `0xA0`–`0xDF` are the printable codes — and
every one of the other 192 bytes is written as a `{0xNN}` raw-byte escape. There
are no named escapes at all: no colour, no cursor controls and no graphics
characters. The three codes the machine itself acts on are listed so a program
can be written against them, but they keep the `{0xNN}` spelling every other
non-printing byte has, because the machine never gave them names either.

## On the Apple II

The same 64 shapes, and the top two bits of a screen byte pick the video mode
that shape is drawn in rather than picking another shape. So there are two named
escapes, `{INV<c>}` and `{FLASH<c>}`, for the inverse and flashing forms of any
character, and a `{0xNN}` raw-byte escape for the second normal-video run.
Inside a program line only the codes with bit 7 set can be written: below `0x80`
a byte is a token there, so the inverse and flashing forms are `POKE`d to the
text page or carried in a data block instead.

See also the [Integer BASIC reference](../integer-basic) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="integerBasicEscapes" />
