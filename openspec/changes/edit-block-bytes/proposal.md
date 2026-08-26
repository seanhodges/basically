## Why

A memory block is bytes at an address. The IDE can currently edit those bytes
one way only — as assembly, for a code block on a CPU it has an engine for.
Every other block is a dead end: the editor pane shows a notice reading "This
file format is not yet supported", naming the block and its size, offering
nothing to do with it.

Two kinds of block land there. A **data** block — a sprite table, a character
set, a level map, a lookup table — is not assembly and never will be;
disassembling it produces nonsense, which is exactly why it has a separate kind.
And a code block on a dialect with no machine-code support at all falls through
to the same notice. The user reaches the first case by switching a block's kind
in its Settings dialog, or by opening a sample that declares one; the IDE lets
them make a block it then refuses to show. On the Sinclair machines they reach
it a third way, by switching a *listing* block — machine code carried in a REM
line — to data.

The gap is also asymmetric in a way that reads as unfinished rather than
deliberate. A block's bytes can already be *exported* — every block tab offers a
`.bin` download — and imported machine code arrives as blocks routinely. What is
missing is the inbound half: no way to bring a `.bin` back into a block, and no
way to change a byte without going through assembly.

The intent is inherited from the retired `memory-blocks-edit-export-and-plan.md`,
whose Stages 1 and 2 specified a byte editor as the first write path. The
assembly editor overtook it and shipped first; the byte-level path was never
built. This proposal preserves that intent so retiring the plan document loses
nothing. The *surface* it specified has been reconsidered against the tree as it
now stands — see `design.md`.

## What Changes

- A **data** block opens in a **byte editor** — an address gutter, a hex view and
  a character view of the same bytes — instead of a not-supported notice. So does
  a code block on a CPU with no assembler engine.
- The two views are **one document**: hex and characters side by side where there
  is room, as tabs where there is not, always sharing a row and an address. The
  caret marks the same byte in both, and a change through either is visible in
  the other immediately, because it is one edit and not two.
- The user can **change bytes in place**: type hex digits in the hex view, or
  type characters into the character view and have the machine's charset encode
  them. A key that is not a hex digit is ignored in the hex view. Editing is
  **overwrite only** — no insert or delete — so a block's addresses never shift
  under the BASIC that references them.
- The character view renders through the **machine's own character set**, not
  ASCII, so the bytes look the way that machine would show them.
- The byte editor takes input from **the same on-screen keyboard the BASIC and
  assembly editors use**, rather than a keypad of its own.
- The user can **resize a block** as an explicit gesture: growing pads with a
  fill byte, shrinking asks first.
- The user can **fill a range of bytes** with a byte value, given as an address
  range.
- The user can **load bytes into a block from a file**, the inbound counterpart
  to the `.bin` download the block tab already offers.
- Byte edits are **undoable within the block**, and that history survives showing
  another tab and coming back — the same guarantee a code block's assembly
  history already carries.
- A **code** block keeps opening in the assembly editor. This change adds a
  second surface, it does not replace the first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `memory-blocks`: one requirement added — *Blocks are editable as bytes* —
  covering the byte surface, its two linked views, overwrite-only editing, the
  character view through the machine's charset, resize, fill, loading bytes from
  a file, and per-block undo. The existing *Code blocks are editable as assembly*
  requirement is unchanged: this is the second editing surface, not a
  replacement.

`code-editor` gets **no spec delta, but it is not untouched**. On the Sinclair
machines a listing block's bytes live inside the BASIC listing, so committing a
byte edit rewrites the program text and clears the BASIC editor's undo history.
That behaviour already exists — the assembly editor commits listing blocks the
same way — so this change adds a second route to it rather than new behaviour to
specify. It is recorded here because an earlier draft of this proposal claimed
the BASIC editor's undo was untouched, which is false for those blocks.

`persistence` is **not** affected: a block's bytes already persist through
autosave, the project bundle and share links. Editing them changes their value,
not how they travel.

## Non-goals

- **Insert and delete.** Overwrite only. A block is bytes at a fixed address, and
  BASIC that calls into the middle of one must keep working; shifting bytes under
  a running reference is a footgun with no upside. Resize is the deliberate,
  explicit way to change a block's length.
- **Drag-selecting a range of bytes.** The caret addresses one byte. Filling a
  range is done by naming the range, not by sweeping it. Byte-granular selection
  over two linked views is the fiddliest part of this surface and the least
  needed; it can be added later without disturbing anything here.
- **A disassembly view for data blocks.** The kinds exist precisely to keep these
  apart. A user who wants to see a data block as code changes its kind.
- **Editing a code block's bytes directly while it has assembly source.** The
  relationship between a block's assembly and its bytes — which wins, what
  happens to the other — is a real design question that the auto-assemble model
  currently answers by making assembly authoritative for code blocks. Opening a
  second writer onto the same bytes needs that question answered first, and it is
  not needed to close the data-block gap. Code blocks reach the byte editor only
  when their CPU has no engine, in which case there is no assembly source to
  conflict with.
- **A global hex viewer over machine memory.** This edits a block, not RAM. The
  memory map and its activity view are where machine memory is inspected.
- **Structured data views.** No sprite grid, tile editor, or table view. Bytes and
  characters.

## Impact

Affected code:

- `src/components/Workspace.tsx` — a data block, and a code block whose CPU has
  no engine from `asmEngineFor`, route to the byte editor. `UnsupportedBlockNotice`
  stays, but only for a code block on a dialect with no `memoryBlocks` capability
  at all; its copy no longer describes a data block and should say so.
- New byte-editor component, built on CodeMirror as the assembly editor is, with
  the block's bytes projected into its document. See `design.md` for why this is
  not a hand-rolled grid.
- New pure projection module — bytes to document text and back, and the mapping
  between a document offset and a byte index — with the view mode (hex, chars, or
  both) and the bytes-per-row as its inputs.
- New pure editing model module — apply a nibble, apply a character through
  `CharsetMapping.toMachine`, resize, fill — unit-testable with no DOM, in the
  shape of the existing `src/app/blockEdit.ts`.
- `src/components/EditorTabBar.tsx` — a "Load bytes…" entry in the block tab's
  context menu, beside the existing `.bin` and `.asm` downloads.
- Byte edits commit through the store's existing `upsertBlock` for an ordinary
  block, and through `commitListingBlockBytes` for a listing block, forking
  exactly as `AsmEditor` already does.
- `e2e/memory-blocks/asm-editor.spec.ts` — the test asserting a data block shows
  the not-yet-supported placeholder is replaced, not deleted.

Prior art to reuse rather than reinvent:

- `src/editor/bufferHistory.ts` — per-buffer document, selection and undo stacks
  across tab switches, already keyed for blocks by `blockBufferKey`.
- `src/editor/binaryLineWidget.ts` and `src/editor/controlChipWidget.ts` — how
  this codebase already makes a CodeMirror caret address something other than a
  character, via `EditorView.atomicRanges`.
- `src/storage/files.ts` — `openBinaryFile(accept)` handles the file picker and
  the fallback iOS Safari needs; `ImportDialog.tsx` and `SettingsForm.tsx` are the
  callers to mirror. Nothing in the tree hand-rolls a file input.
- `src/asm/format.ts` — `formatWord` for the gutter's addresses, so they read as
  every other address in the IDE does.
- `src/keyboard/` — the on-screen keyboard, reached through the existing
  `KeyboardTarget` / `EditorKeyAction` seam.

`src/storage/vfs/hexdump.ts` is *not* reusable here: it renders a read-only
string dump with an ASCII-only gutter for the VFS inspector. It is a layout
convention worth matching, not code to share, and it stays as it is.

No dependency changes — CodeMirror is already the editor for both existing
surfaces.
