---
title: <Machine family> BASIC reference
---

<!--
Template: docs/reference/<page>.md — the parent reference page.
Replace <angle-bracket> placeholders (including this file's frontmatter
title, which follows the exact pattern "<Machine family> BASIC reference").
Rules:
- The intro is ONE sentence starting "Every command, function and operator in".
  A second paragraph only where the page covers several machines and has to
  explain how their rows are badged. No editorialising about the reader.
- The "In this reference:" bar is the page's whole navigation. There is no
  closing cross-link paragraph.
- "Notes and caveats" is 5-7 bullets, ranked most important first: the traps a
  program will actually hit, then the statement/line, naming and operator rules.
  Cut anything the table below already states - a keyword's own behaviour, its
  error text, its nesting limit, its availability tag. Hardware facts belong on
  the hardware page. A page covering several machines may group the bullets
  under a "###" per machine; each group is capped at 7 on its own.
- The <ReferenceTable> comes straight after the caveats. A machine may earn a
  further section, but it goes BELOW the table, never above it.
- Keywords the machine tokenizes and then will not run - whatever the reason -
  go under "## What this machine does not run", spelled exactly that way. A
  machine with nothing to declare gets no section; do not invent a variant.
- src/reference/page-structure.test.ts enforces all of the above.
- Delete this comment block from the generated page.
-->

<script setup>
import { <page>Reference } from './data/<page>';
</script>

# <Machine family> BASIC reference

Every command, function and operator in <full dialect name>.

**In this reference:** [Hardware](./<page>/hardware) · [Escape codes](./<page>/escapes) · [File formats](./<page>/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- <The trap a program is most likely to hit: greedy keyword matching, a name
  rule that silently collides, spaces being thrown away.>
- <Statement/line-number rules, e.g. multi-statement lines, ELSE, ranges.>
- <Variable naming and type-suffix rules.>
- <Operator semantics that differ from the neighbouring machines: what a true
  comparison answers, whether AND/OR are bitwise, which power operator.>
- <Operators or real-machine features deliberately absent from the table, with
  why.>

<ReferenceTable :data="<page>Reference" />

<!-- Optional, and only where the machine has something to declare: -->

## What this machine does not run

<Keywords that tokenize and then answer an error or do nothing, and why - a ROM
that names hardware the machine never had, or a backend this IDE runs it on.>
