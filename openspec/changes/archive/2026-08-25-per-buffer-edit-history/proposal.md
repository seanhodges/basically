## Why

The editor pane holds several buffers behind two CodeMirror views — the BASIC
program, any scratch buffers, and a memory block's assembly — but the app still
treats "the editor" as a singleton. The Edit menu's Undo, Redo and clipboard
entries reach only the BASIC view, so on a block tab they silently rewind the
hidden program instead of the assembly on screen; a block's history is thrown
away whenever the user leaves its tab; and because switching between the program
and a scratch buffer is applied as an ordinary editor transaction, one Undo after
a tab switch pulls the other buffer's text across and writes it into the buffer
being shown. The last of these is silent data loss, not a cosmetic fault.

## What Changes

- Undo, Redo, Cut, Copy, Paste and Find from the Edit menu act on the buffer the
  user is looking at, matching what the keyboard shortcuts already do.
- Every buffer — the program, each scratch buffer, each code block — keeps its
  own edit history, and that history survives switching away and back.
- Switching tabs is no longer an editable change: it cannot be undone, and undo
  can never move text between buffers.
- Actions that genuinely replace the on-screen buffer's text (applying an AI
  block, opening a file, loading a sample) stay undoable, so the AI assistant's
  "reversible through the editor's normal undo" guarantee is unaffected.
- A code block's editor gains Find/Replace, which it does not have today, so the
  Edit menu offers the same set of actions on every editable tab.
- Edit-menu entries that only make sense for BASIC — Renumber, Renumber file,
  Procedures — are unavailable while a block tab is showing, rather than acting
  on the hidden program.
- Re-seeding a block's editor after its bytes change externally is not undoable,
  since undoing it would restore text that no longer describes the bytes.

## Non-goals

- No change to which keys are bound: `Mod-Z` / `Mod-Shift-Z` already route to the
  focused editor and keep doing so.
- No undo history for anything outside the two code editors — the AI prompt box,
  settings fields and the tab-rename input keep the browser's native undo.
- No undo across document boundaries: opening a file or switching machine still
  starts from a clean history.
- No editing of `kind: 'data'` blocks, which remain a placeholder.
- No persistence of undo history through autosave or reload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: adds a requirement that the editing actions offered by the
  toolbar act on the buffer on screen; amends "Disposable scratch buffers" so
  each buffer carries its own edit history and switching buffers is not an
  undoable edit.
- `memory-blocks`: amends "Code blocks are editable as assembly" so a block's
  editor offers the same editing actions as the BASIC editor and keeps its edit
  history across tab switches.

## Impact

- `src/components/CodeMirrorHost.tsx` — the single BASIC/scratch view: its
  extension list becomes a reusable builder, it swaps buffer state instead of
  rewriting the document, and it stops claiming Edit-menu commands while a block
  tab is showing.
- `src/components/AsmEditor.tsx` — stops being remounted per block, gains
  search and the Edit-menu command channel, and re-seeds without touching
  history.
- `src/components/Workspace.tsx` — tells each view which buffer it is showing.
- `src/app/store.ts` — `withActiveTab` no longer pushes text through the
  document-override channel; that channel narrows to genuine content
  replacement, and the buffer histories are dropped when the document is
  replaced.
- `src/components/Toolbar.tsx` — BASIC-only Edit entries are disabled on a block
  tab.
- New helper modules under `src/editor/` for buffer-state snapshots and the
  view-generic editor commands, both colocated with `*.test.ts`.
- No new runtime dependency: the buffer-state snapshot uses `historyField`,
  already exported by the pinned `@codemirror/commands`.
- e2e: `e2e/code-editor/` and `e2e/memory-blocks/`.
