---
title: GE-235 escape codes
---

<script setup>
import { ge235Escapes } from '../../../src/reference/escapes/ge235';
</script>

# GE-235 escape codes

Every escape that can be typed in GE-235 source, and the code it stores. Escapes are recognised in string literals, REM text and DATA bodies. This machine's characters are six bits rather than eight, so there are 64 codes in all and only seven of them print nothing — those seven are the whole of this table, written as `{0oNN}` in octal because the machine's own listings are octal throughout. There are no named escapes: no colour, no cursor controls and no graphics, because a Teletype printing on paper has nothing to address. The braces cost nothing to reserve as notation, since neither `{` nor `}` is a GE-235 character. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Dartmouth BASIC reference](../ge235) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="ge235Escapes" />
