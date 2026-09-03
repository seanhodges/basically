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
  dialect's audio codec implements. Its opening sentence is the shared one -
  "mic / line-in", "mono 44.1 kHz" - so keep that wording exactly.
- A page whose machines have a container AND a tape scheme each (the Sinclair
  and Integer BASIC pages) organises by machine instead: "## The <machine>" per
  machine, with the containers and a "### Cassette audio" as "###" under it.
  Every repeated heading then needs an explicit machine-scoped anchor
  ("### Cassette audio {#zx81-cassette-audio}") and links must use it.
- Where an export cannot carry the document's memory blocks, say so and add
  that the Transfer dialog names the blocks it would leave behind. That is one
  mechanism across every such machine, not a per-machine courtesy.
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
