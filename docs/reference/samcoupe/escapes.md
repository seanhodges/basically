---
title: SAM Coupé escape codes
---

<script setup>
import { samcoupeEscapes } from '../../../src/reference/escapes/samcoupe';
</script>

# SAM Coupé escape codes

Every escape that can be typed in SAM Coupé source, and the byte it stores.
Escapes are recognised in string literals, `REM` comments and `DATA` bodies. The
SAM's font covers `0x20`–`0x7F` with a real glyph for every code — including
both letter cases, `£` at `0x60`, `©` at `0x7F` and the up arrow at `0x5E` that
is also the power operator — and the sixteen 2×2 block graphics at `0x80`–`0x8F`
and the twenty-five user-defined characters at `0x90`–`0xA8` are written as
their Unicode equivalents, so most of the character set needs no escape at all.
What is left is the eight embedded print-control directives, the `\a`–`\y`
spellings of the user-defined graphics (an alternative to the squared capitals
🄰–🅈, so they are accepted on the way in and never produced on the way out), the
backslash that has to escape itself, and the raw `{0xNN}` form for everything
else. A `{…}` spelling no directive is ordinary text, the SAM having real braces
at `0x7B` and `0x7D`. Filters can be prefilled with `?q=` and `?cat=` query
parameters.

See also the [SAM BASIC reference](../samcoupe) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="samcoupeEscapes" />
