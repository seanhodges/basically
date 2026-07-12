---
title: ZX Spectrum escape codes
---

<script setup>
import { zxspectrumEscapes } from '../data/escapes/zxspectrum';
</script>

# ZX Spectrum escape codes

Every escape that can be typed in Spectrum source (48K and 128K - differences are tagged), and the bytes it stores. Escapes are recognised inside string literals and REM bodies, and the control/UDG forms are also accepted in expressions so imported listings with embedded control bytes re-tokenize byte-exactly. A `{...}` that is not a recognised directive stays literal text. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [ZX Spectrum BASIC reference](../zxspectrum) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="zxspectrumEscapes" />
