---
title: TRS-80 escape codes
---

<script setup>
import { trs80Escapes } from '../../../src/reference/escapes/trs80';
</script>

# TRS-80 escape codes

Every escape that can be typed in TRS-80 source, and the byte it stores. Escapes are recognised in string literals, REM/`'` comments and DATA bodies. Block graphics 0x81-0xBF are typed as unicode sextant glyphs rather than escapes; only the listed control, blank-graphics and space-compression bytes need the `{0xNN}` form. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [TRS-80 Level II BASIC reference](../trs80) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="trs80Escapes" />
