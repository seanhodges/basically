## Context

This design is preserved from `docs/contributing/memory-blocks-edit-export-and-plan.md`
(Stages 1–2) — a plan removed from the tree once the rest of it shipped, and
readable in git history. The hex editor was
specified there as the *first* write path for blocks; the assembly editor
overtook it and shipped first, leaving the byte path unbuilt and data blocks
with no editor at all. The reasoning below is that plan's, restated against the
tree as it now stands.

See `docs/contributing/architecture.md` for the dialect seam and the store's
command-bus conventions; this change does not alter either.

## Goals / Non-Goals

**Goals**

- Every block the IDE lets a user create has somewhere to edit it.
- Byte editing that behaves like the hex editors this audience already knows:
  fixed geometry, overwrite, addresses that do not move.
- The editing rules live in a pure module, testable without a DOM, so the
  component is a rendering concern.
- Usable on a phone, where the IDE already expects to work.

**Non-Goals**

- Competing with the assembly editor for code blocks (see the proposal's
  non-goals — the bytes/assembly authority question stays closed).
- Any structured or typed view of a block's contents.

## Decisions

### A hand-rolled grid, not CodeMirror

A hex editor is a fixed-geometry, two-column, overwrite-mode surface where the
caret addresses a *byte* and the same byte appears twice. CodeMirror's model is
a mutable text document with insert-mode editing and a caret addressing a
character offset — every one of those properties has to be fought.

**Decision: a plain React grid over the block's `Uint8Array`.** No new
dependency. Rows are windowed by hand — blocks are bounded by the machines
themselves (48 KB is the practical ceiling), so windowing is arithmetic, not a
virtualisation library. Bytes per row steps 16 / 8 / 4 by container width.

The windowing arithmetic is extracted to a pure function and tested there, not
through the component.

### Overwrite only; resize is the explicit gesture

Insert and delete would shift every byte after the caret, silently invalidating
any BASIC that calls into the block and any absolute reference inside it. Classic
hex editors are overwrite for the same reason.

**Decision: typing never changes a block's length.** Growing and shrinking is a
separate, named action: grow pads with a fill byte, shrink asks first because it
discards data.

### The character column goes through the machine's charset

Every dialect exposes `CharsetMapping.glyph(code)` (total over `0x00`–`0xFF`)
and `toMachine(text)`. A hex editor that showed ASCII would be lying on most of
these machines, where `0x00`–`0x1F` are graphics and the letters sit at
machine-specific codes.

**Decision: render with `glyph`, encode typed characters with `toMachine`.** A
character the machine cannot represent is refused with a visible flash, not
silently substituted.

### Editing rules are a pure model

**Decision: apply-nibble, apply-character, resize and fill live in a module with
no React and no DOM**, in the shape of the existing `src/app/blockEdit.ts`. The
fiddly parts — high-then-low nibble sequencing, auto-advance at the end of a
byte, clamping at block bounds, charset round-tripping — are exactly what a unit
test can pin and a browser test cannot pin cheaply.

### Undo is per-block and bounded

**Decision: byte-edit history lives in component state, bounded, and clears when
the user leaves the block.** Deliberately not the global store: CodeMirror owns
BASIC undo, and a single undo stack spanning two editors with different models
produces surprises in both. The cost is that leaving a block is a commit point,
which matches how the assembly editor already behaves.

## Risks / Trade-offs

- **Touch nibble entry is unproven.** Typing hex on a phone through an on-screen
  keypad is the least-tested interaction in this design and should be expected to
  need a second pass after real use. It is also the reason the keypad is part of
  this change rather than a follow-up: shipping a hex editor that cannot be used
  on the platform half the IDE's users are on would be shipping it twice.
- **A hand-rolled grid takes on scrolling, focus and selection** that a library
  would provide. Mitigated by the bounded block size and by keeping all logic out
  of the component.
- **Two editing surfaces for one data model.** Kept safe here only because their
  domains do not overlap: assembly for code blocks with an engine, hex for
  everything else. If that ever overlaps, the authority question in the
  proposal's non-goals has to be answered first.

## Migration Plan

None. No stored shape changes: a block is already bytes, and the hex editor is a
second way to view and change them.

## Open Questions

- Should a block's kind be switchable *from* the hex editor, or stay in the
  Settings dialog only? Settings-only is the smaller change and the assumption
  here.
- Is there a case for a read-only hex view of a code block *alongside* its
  assembly — showing the bytes the assembler produced? Useful, cheap once the
  grid exists, and free of the authority problem because it is read-only. Worth
  deciding during implementation.
