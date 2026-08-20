---
title: PMD 85 escape codes
---

<script setup>
import { pmd85Escapes } from '../../../src/reference/escapes/pmd85';
</script>

# PMD 85 escape codes

Every escape that can be typed in PMD 85 source, and the byte it stores. Escapes are recognised in string literals, REM comments and DATA bodies. The table is short because the character set is: Monitor 2's generator holds printable ASCII and one solid cell, with no accented letters and no block graphics anywhere in it, so everything without a glyph is written in the raw `{0xNN}` form. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [BASIC-G reference](../pmd85) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="pmd85Escapes" />
