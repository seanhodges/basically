---
title: <Machine family> hardware
---

<!--
Template: docs/reference/<page>/hardware.md — the hardware sub-page.
Replace <angle-bracket> placeholders (including this file's frontmatter
title, pattern "<Machine family> hardware").
Rules:
- One "## <Machine>" section per machine that runs the dialect, in registry
  order, ALWAYS — even for a single-machine dialect. The five "###"
  sub-headings appear in this fixed order under every machine.
- Memory = where memory blocks live: ranges, default address and warned
  regions MUST match src/dialects/<id>/memoryBlocks.ts + memoryMap.ts, plus
  how blocks travel (project bundle/share links/native container import) and
  the run-time overlap checks. End with the three standard links (guide,
  file-formats overview, CPU assembly reference).
- A machine without a feature gets one flat sentence in the same shape as the
  existing pages ("The ZX81 has no sound hardware."). A feature the real
  machine has but the dialect doesn't implement is stated as such — never
  claimed, never omitted.
- Second and later machines describe deltas and refer to the first machine's
  sections (link "#memory") for what is identical.
- Link depth from this sub-directory: ../<page>, ./escapes, ../file-formats,
  ../z80-assembly or ../6502-assembly, ../../guide/machine-code.
- Delete this comment block from the generated page.
-->

# <Machine family> hardware

The screen, colour, graphics and sound hardware of each machine that runs
[<dialect name>](../<page>), and where machine-code and data blocks live in its
memory.

## <Machine A>

### Screen modes

<Display geometry, mode-select keyword; use a mode table (see the BBC/CPC
pages) when the machine has several modes.>

### Colour

<Colour count and the keywords/POKEs that set it, or the flat no-colour
sentence.>

### Graphics

<Plot/draw keywords with coordinate ranges and origin, or character-graphics
description, or the flat no-bitmap sentence.>

### Sound

<Sound keywords with channel/parameter shape, or the flat no-sound sentence.>

### Memory

<Block placement rules from memoryBlocks.ts: window, default, warned regions;
how blocks travel and import; run-time checks.>

See the [machine code guide](../../guide/machine-code) and the cross-dialect
[Machine code & data blocks](../file-formats#machine-code-data-blocks) overview.
Every mnemonic, directive and operand form the assembly editor accepts is in the
[<CPU> assembly reference](../<cpu>-assembly).

## <Machine B>

### Screen modes

<Delta from Machine A, or "Identical to the <Machine A> — …".>

### Colour

<Delta or identical.>

### Graphics

<Delta or identical.>

### Sound

<Delta or identical.>

### Memory

<Delta (its own ranges/PAGE/default) plus "the same … described
[above](#memory) apply".>
