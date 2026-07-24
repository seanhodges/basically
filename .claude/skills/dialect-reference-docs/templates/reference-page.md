---
title: <Machine family> BASIC reference
---

<!--
Template: docs/reference/<page>.md — the parent reference page.
Replace <angle-bracket> placeholders (including this file's frontmatter
title, which follows the exact pattern "<Machine family> BASIC reference").
Rules:
- The intro is ONE sentence starting "Every command, function and operator in".
- "Notes and caveats" is short bullets, dialect-language-level only (statement/
  line rules, variable naming, operators not in the table, tag explanations,
  not-yet-implemented features). Hardware facts belong on the hardware page.
- No other sections. The closing cross-link paragraph is identical on every
  page except the link targets; a dialect sharing another page's sub-pages
  (like the PET) says "the shared" and points at them.
- Delete this comment block from the generated page.
-->

<script setup>
import { <page>Reference } from './data/<page>';
</script>

# <Machine family> BASIC reference

Every command, function and operator in <full dialect name>.

## Notes and caveats

- <Statement/line-number rules, e.g. multi-statement lines, ELSE, ranges.>
- <Variable naming and type-suffix rules.>
- <Tag explanation if the table uses tags, e.g. "Keywords tagged **128K only**
  are available solely on the 128K models.">
- <Operators or real-machine features deliberately absent from the table, with
  why.>

<ReferenceTable :data="<page>Reference" />

The machine hardware — screen modes, colour, graphics, sound and memory — is on
the [hardware](./<page>/hardware) page; the control codes and graphics bytes
you can embed in source are on the [escape codes](./<page>/escapes) page; the
native file containers and cassette encoding are on the
[file formats](./<page>/formats) page.
