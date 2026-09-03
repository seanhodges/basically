---
title: <Machine family> escape codes
---

<!--
Template: docs/reference/<page>/escapes.md — the escape-codes sub-page.
Replace <angle-bracket> placeholders (including this file's frontmatter
title, pattern "<Machine family> escape codes").
Rules:
- One dense intro paragraph: what an escape is on this machine, which
  contexts recognise escapes (strings/REM/DATA/expressions), any parse-only
  alias families, and always the closing sentence about ?q=/?cat= prefill.
- Keep the "See also" lines in exactly this form.
- Where the machine needs more than the intro paragraph can hold, use "##"
  sections and put them ABOVE the table, as the BBC page does - never below it,
  and never as one long undifferentiated paragraph.
- Delete this comment block from the generated page.
-->

<script setup>
import { <page>Escapes } from '../data/escapes/<page>';
</script>

# <Machine family> escape codes

Every escape that can be typed in <machine> source, and the byte it stores.
<Contexts where escapes are recognised; alias spellings accepted on parse;
anything byte-exactness depends on.> Filters can be prefilled with `?q=` and
`?cat=` query parameters.

See also the [<dialect name> reference](../<page>) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="<page>Escapes" />
