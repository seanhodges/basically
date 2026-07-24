---
title: <Machine family> file formats
---

<!--
Template: docs/reference/<page>/formats.md — the file-formats sub-page.
Replace <angle-bracket> placeholders (including this file's frontmatter
title, pattern "<Machine family> file formats").
Rules:
- One "## <Machine prefix> `.ext`" section per native container the dialect's
  targets.ts exports/imports (machine-prefixed headings — "## ZX81 `.P`", not
  "## `.P`"), covering the byte layout, what travels inside (program, memory
  blocks, variables), and import/export behaviour.
- Always close with "## Cassette audio" describing the tape encoding the
  dialect's audio codec implements.
- Cross-link the cross-machine overview (../file-formats) and this page's
  siblings where useful.
- Delete this comment block from the generated page.
-->

# <Machine family> file formats

<One-paragraph intro: the native container(s), what carries memory blocks, and
a link to the cross-machine [file formats overview](../file-formats).>

## <Machine prefix> `.<ext>`

<Byte layout, load addresses, what the container holds, import/export rules.>

## Cassette audio

<Tape encoding: header/sync scheme, byte encoding, what the exported WAV
contains, load instructions on real hardware.>
