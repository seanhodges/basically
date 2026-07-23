---
title: Amstrad CPC escape codes
---

<script setup>
import { cpcEscapes } from '../data/escapes/cpc';
</script>

# Amstrad CPC escape codes

The Amstrad CPC's block graphics and symbols are typed as their Unicode glyphs
(`█`, `▛`, `α`, `♠`…), and every code with no printable form is written as a raw
`{0xNN}` byte, so imported listings re-tokenize byte-exactly. The escapes that
carry meaning are the firmware's **text VDU control codes** 0x00–0x1F — the
`CHR$` codes that move the cursor, switch `MODE`, set `PEN`/`PAPER`/`INK`, ring
the buzzer and so on. Each stores a single introducer byte; several then read
further bytes from the print stream, noted per row.

Escapes are recognised inside string, `REM` and `DATA` literals; a `{...}` that
is not a recognised escape stays literal text (the CPC has real `{`/`}`
characters at 0x7B/0x7D). Filters can be prefilled with `?q=` and `?cat=` query
parameters.

See also the [Amstrad CPC Locomotive BASIC reference](../cpc) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="cpcEscapes" />
