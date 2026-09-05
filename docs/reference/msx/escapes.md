---
title: MSX escape codes
---

<script setup>
import { msxEscapes } from '../../../src/reference/escapes/msx';
</script>

# MSX escape codes

Every escape that can be typed in MSX source, and the byte it stores. Escapes
are recognised in string literals, `REM` comments and `DATA` bodies. The MSX
International character set has a real glyph for almost every byte — accented
letters, block graphics, Greek and mathematics all print as themselves — so the
only bytes needing an escape are the control codes below `0x20`, the delete at
`0x7F` and the cursor cell at `0xFF`, and every one of them is written in the
raw `{0xNN}` form. A brace pair spelling no such escape is ordinary text, the
machine having real braces at `0x7B` and `0x7D`. The rows below therefore say
what each byte _does_ when it is printed. The four graphic characters are the
exception to all of that: they are one character in the editor and two bytes in
the program, the graphic header `0x01` followed by the code plus `0x40`. Filters
can be prefilled with `?q=` and `?cat=` query parameters.

See also the [MSX BASIC reference](../msx) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="msxEscapes" />
