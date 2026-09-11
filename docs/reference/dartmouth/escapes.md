---
title: Dartmouth BASIC escape codes
---

<script setup>
import { dartmouthEscapes } from '../../../src/reference/escapes/dartmouth';
</script>

# Dartmouth BASIC escape codes

Every escape that can be typed in GE-235 or GE-635 source, and the code it stores. Escapes are recognised in string literals, REM text and DATA bodies. These two machines share a BASIC and not a character set, so every row below says which one it belongs to. The GE-235's characters are six bits — 64 codes in all, only seven of which print nothing — and are written `{0oNN}` in octal, because the machine's own listings are octal throughout. The GE-635's are ASCII: 128 codes, with characters given to 32 through 95 and everything else written `{0xNN}` in hexadecimal. Neither machine has a named escape — no colour, no cursor controls and no graphics — because a Teletype printing on paper has nothing to address. The braces cost nothing to reserve as notation, since neither `{` nor `}` is a character on either machine. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Dartmouth BASIC reference](../dartmouth) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="dartmouthEscapes" />
