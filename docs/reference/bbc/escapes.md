---
title: BBC escape codes
---

<script setup>
import { bbcEscapes } from '../data/escapes/bbc';
</script>

# BBC escape codes

Every escape that can be typed in BBC BASIC source (Micro and Master share the notation), and the byte it stores. Escapes are recognised in string literals, REM and DATA bodies and `*`-command lines - the contexts where raw bytes live in a real program. On a MODE 7 screen the named teletext escapes are the colour/effect control bytes. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [BBC BASIC reference](../bbc) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="bbcEscapes" />
