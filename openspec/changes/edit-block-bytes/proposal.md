## Why

A memory block is bytes at an address. The IDE can currently edit those bytes
one way only — as assembly, for a code block on a CPU it has an engine for.
Every other block is a dead end: the editor pane shows a notice reading "This
file format is not yet supported", naming the block and its size, offering
nothing to do with it.

Two kinds of block land there. A **data** block — a sprite table, a character
set, a level map, a lookup table — is not assembly and never will be;
disassembling it produces nonsense, which is exactly why it has a separate kind.
And a **code** block on a machine whose CPU has no assembler engine falls through
to the same notice. The user reaches the first case by switching a block's kind
in its Settings dialog, or by opening a sample that declares one; the IDE lets
them make a block it then refuses to show.

The gap is also asymmetric in a way that reads as unfinished rather than
deliberate. A block's bytes can already be *exported* — every block tab offers a
`.bin` download — and imported machine code arrives as blocks routinely. What is
missing is the inbound half: no way to bring a `.bin` back into a block, and no
way to change a byte without going through assembly.

This design is inherited from the retired `memory-blocks-edit-export-and-plan.md`,
whose Stages 1 and 2 specified a hex editor as the first write path. The
assembly editor overtook it and shipped first; the byte-level path was never
built. This proposal preserves that design so retiring the plan document loses
nothing.

## What Changes

- A **data** block opens in a **hex editor** — address gutter, hex cells, and a
  character column rendered in the machine's own charset — instead of a
  not-supported notice. So does a code block on a CPU with no assembler.
- The user can **change bytes in place**: type hex digits over a cell, or type
  characters into the character column and have the machine's charset encode
  them. Editing is **overwrite only** — no insert or delete — so a block's
  addresses never shift under the BASIC that references them.
- The user can **resize a block** as an explicit gesture: growing pads with a
  fill byte, shrinking asks first.
- The user can **fill a selection** with a byte value.
- The user can **load bytes into a block from a file**, the inbound counterpart
  to the `.bin` download the block tab already offers.
- Byte edits are **undoable within the block**, independently of the BASIC
  editor's own history.
- The hex editor is **usable on a touch screen**: an on-screen hex keypad, and
  targets big enough to hit.
- A **code** block keeps opening in the assembly editor. This change adds a
  second surface, it does not replace the first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `memory-blocks`: one requirement added — *Blocks are editable as bytes* —
  covering the hex surface, overwrite-only editing, the character column through
  the machine's charset, resize, fill, loading bytes from a file, and per-block
  undo. The existing *Code blocks are editable as assembly* requirement is
  unchanged: this is the second editing surface, not a replacement.

`code-editor` is **not** affected: the hex editor is its own surface, not a
CodeMirror mode. The BASIC editor, its linting, completion and undo are
untouched.

`persistence` is **not** affected: a block's bytes already persist through
autosave, the project bundle and share links. Editing them changes their value,
not how they travel.

## Non-goals

- **Insert and delete.** Overwrite only. A block is bytes at a fixed address, and
  BASIC that calls into the middle of one must keep working; shifting bytes under
  a running reference is a footgun with no upside. Resize is the deliberate,
  explicit way to change a block's length.
- **A disassembly view for data blocks.** The kinds exist precisely to keep these
  apart. A user who wants to see a data block as code changes its kind.
- **Editing a code block's bytes directly while it has assembly source.** The
  relationship between a block's assembly and its bytes — which wins, what
  happens to the other — is a real design question that the auto-assemble model
  currently answers by making assembly authoritative for code blocks. Opening a
  second writer onto the same bytes needs that question answered first, and it is
  not needed to close the data-block gap. Code blocks reach the hex editor only
  when their CPU has no engine, in which case there is no assembly source to
  conflict with.
- **A global hex viewer over machine memory.** This edits a block, not RAM. The
  memory map and its activity view are where machine memory is inspected.
- **Structured data views.** No sprite grid, tile editor, or table view. Bytes and
  characters.
- **Unbounded undo.** A bounded, per-block history, cleared when the user leaves
  the block. The BASIC editor keeps owning BASIC undo.

## Impact

Affected code (as scoped by the retired plan; confirm against the tree when
implementing):

- `src/components/Workspace.tsx` — a data block, and a code block with no engine,
  route to the hex editor instead of `UnsupportedBlockNotice`. The notice
  survives only for a block neither surface can open, if such a case remains.
- New hex editor component and its stylesheet — the grid, the character column
  via the dialect's `CharsetMapping.glyph`, the address gutter, and the touch
  keypad. Column count adapts to the container width.
- New pure editing model module — apply a nibble, apply a character through
  `CharsetMapping.toMachine`, resize, fill — unit-testable with no DOM, in the
  shape of the existing `src/app/blockEdit.ts`.
- `src/components/EditorTabBar.tsx` — a "Load bytes…" entry in the block tab's
  context menu, beside the existing `.bin` and `.asm` downloads.
- Byte edits go through the store's existing `upsertBlock` with a fresh array,
  as every other block mutation does.

Prior art to reuse rather than reinvent: `src/storage/vfs/hexdump.ts` already
formats a hex dump for the VFS inspector, and `src/asm/format.ts` already
formats addresses and bytes for the assembly surfaces. The VFS inspector's own
read-only dump stays as it is.

No dependency changes — the grid is hand-rolled, as the retired plan specified,
because a fixed-geometry two-column overwrite surface fights every text-editor
component in the tree.
