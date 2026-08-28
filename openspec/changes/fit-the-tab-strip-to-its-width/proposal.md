## Why

The editor's tab strip has two different, and equally poor, answers to running out
of room. Memory-block and scratch-buffer tabs have none: the strip scrolls
sideways, so tabs slide off the edge with nothing to say they are there. Saved
data files have a cap of four, and the rest are reached only by leaving the strip
for a modal dialog — "Emulator files" — that lists the same files a second time,
in a second layout, with a second set of download and delete buttons.

That dialog is now redundant twice over. A saved file already has a tab that shows
its bytes and a context menu that downloads and deletes it; the dialog's only
remaining job is being the strip's overflow. One overflow rule, applied to every
tab, retires the dialog and fixes the block and scratch tabs at the same time.

## What Changes

- **BREAKING** (user-visible): the "Emulator files" dialog is removed, along with
  its **File ▸ Emulator files** and **Run ▸ Emulator files** menu entries and its
  `Mod+Alt+F` shortcut. Everything it offered — viewing a saved file's bytes,
  downloading it as `.bin` or `.txt`, deleting it — is already on the file's own
  editor tab.
- The tab strip stops scrolling and fits itself to its real width.
- The **BASIC** tab is pinned first and is always visible.
- Every other tab — memory blocks, scratch buffers and saved files alike —
  competes for the remaining room by recency: most recently used stays, least
  recently used moves out. A saved file the program has just written counts as
  recent, so a new file appears without being asked for.
- Saved files may take only a bounded share of the visible room, so a program
  writing files in a loop cannot evict the tabs the user opened.
- Tabs that do not fit are listed by a count button at the end of the strip;
  picking one brings it into view.
- Visible tabs keep the strip's existing order — BASIC, blocks, scratch buffers,
  saved files. Recency decides which tabs are visible, never where they sit.

## Capabilities

### New Capabilities

None. The strip's overflow behaviour belongs to the capability that already owns
the editor's tabs.

### Modified Capabilities

- `code-editor`: the requirement "Saved data files appear as tabs" currently states
  the overflow guarantee as a saved-files-only rule. It is generalised to the whole
  strip, and joined by a new requirement covering the fit rule: the BASIC tab
  pinned, the rest shown by recency as the width allows, and one place at the end
  of the strip holding everything that does not fit.

## Impact

- **Removed**: `src/components/VfsInspectorDialog.tsx` and its stylesheet, and the
  two helpers written for it alone — `src/app/vfsEmptyState.ts` and
  `src/storage/vfs/hexdump.ts`. `Dialect.capturesDataFiles` stays; it is read by
  `src/dialects/fileIoProbes.ts` and its tests.
- **Unwired**: the `vfsInspectorOpen` store field and its action, the
  `view.vfsInspector` shortcut, the `vfs` entry in the dismissible-surface registry
  (`src/app/surfaces.ts`), and both toolbar menu entries.
- **Added**: a tab-identity helper and transient per-tab recency state in
  `src/app/store.ts`, and a pure fit selector with its own unit tests.
- **Reworked**: `src/components/EditorTabBar.tsx` and its stylesheet — the strip
  measures itself instead of scrolling, and the existing `+N` button opens a menu
  instead of the dialog.
- **Docs**: the strip's fit rule is documented once in `docs/guide/writing-basic.md`
  and linked from `docs/guide/machine-code.md` and `docs/guide/testing-programs.md`;
  the shortcut row leaves `docs/guide/keyboard-shortcuts.md`, and the dialog leaves
  the list in `docs/contributing/architecture.md` and the note in
  `docs/reference/atom.md`.
- **In-app copy** naming the dialog is repointed at the editor tab: the Atom's
  `BPUT`/`FOUT` entries, the C64 AI profile, and the Atom `files.bas` sample.
- No change to the `Dialect` / `MachineEmulator` seam.

## Non-goals

- **No replacement for the dialog's empty-state message.** It told the user, on a
  machine whose emulation does not trap saved files, that nothing would ever appear
  there. An empty tab strip has nowhere to say that, and inventing a new empty
  state for it is out of scope; the fact moves to `docs/guide/testing-programs.md`.
- **No change to what a tab shows**, or to the download/delete actions on a tab's
  context menu.
- **No hex-dump view.** The dialog's dump was a second rendering of what the data
  tab's byte view already shows.
- **No reordering of tabs.** Recency picks which tabs are visible, not their order.
- **No persistence of recency.** It is view state for the session, not part of the
  document or the project bundle.
