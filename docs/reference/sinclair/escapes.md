---
title: Sinclair BASIC escape codes
---

<script setup>
import { sinclairEscapes } from '../../../src/reference/escapes/sinclair';
</script>

# Sinclair BASIC escape codes

Every escape that can be typed in ZX81 or Spectrum source, and the byte it
stores. The three machines share a BASIC and not a character set, so each row is
badged with the machines it belongs to and no code here is common to all of
them. Filters can be prefilled with `?q=` and `?cat=` query parameters.

## On the ZX81

The ZX81 charset applies everywhere in a line — block-graphics escapes, `%c`
inverse video and raw `\{NN}` bytes work in strings, REM bodies and expressions
alike.

## On the Spectrums

Escapes are recognised inside string literals and REM bodies (48K and 128K —
differences are tagged), and the control and UDG forms are also accepted in
expressions so imported listings with embedded control bytes re-tokenize
byte-exactly. A `{...}` that is not a recognised directive stays literal text.

See also the [Sinclair BASIC reference](../sinclair) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="sinclairEscapes" />
