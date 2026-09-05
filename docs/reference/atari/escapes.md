---
title: Atari escape codes
---

<script setup>
import { atariEscapes } from '../../../src/reference/escapes/atari';
</script>

# Atari escape codes

Every escape that can be typed in Atari BASIC source, and the byte it stores.
Escapes are recognised in string literals and in `REM` and `DATA` bodies — the
contexts where a raw byte lives in a real program. ATASCII needs fewer of them
than the machines around it, because most of its low codes are drawings rather
than controls: `0` to `26` are the block and line graphics printed on the fronts
of the keycaps, and they come through as their own characters. What is left is
the fourteen codes that move the cursor or edit the screen, plus `{$xx}` for the
inverse-video half, which has no shapes of its own. Filters can be prefilled
with `?q=` and `?cat=` query parameters.

See also the [Atari BASIC reference](../atari) and
[file formats](../file-formats#escape-notation).

## Inverse video is a solid block

The top bit of a character code is inverse video, and the display chip draws an
inverse character by turning the pixels of the ordinary one over. So a code and
its twin 128 higher are the same shape, light on dark and dark on light — and
the twin of a space is a **solid block**, which is what a text-mode game draws
its bricks, walls and paddles out of.

That block is `{$a0}` in a string, `CHR$(160)` computed, and the ATARI key on
the keyboard while typing. There is no separate graphics character set to switch
into and no colour attached to it: what colour it comes out is whatever the
screen's colour registers hold, which the [hardware](./hardware) page describes.

## Ending a line

`{eol}`, code 155, is this machine's end of line. It is what the RETURN key
stores, what separates the lines of a `LIST` listing, and what terminates every
record the cassette and disk handlers read or write — where most machines here
would use a carriage return of 13. A listing exported from the IDE carries it,
and one imported is read by it; see [file formats](./formats).

<EscapeTable :data="atariEscapes" />
