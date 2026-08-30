## Why

A program's data files are wiped on every emulator start, so a program can only
read back what the same run wrote. Saving a high-score table and reading it on
the next run — the ordinary reason a BASIC program writes a file at all — cannot
be done in the IDE, however correct the program is. The files are also lost to a
reset, to the emulator pane going away (on a phone, that is just opening the
assistant), and to reloading the IDE.

The files are already mirrored into the browser's database; only the rule that
empties them stands between the user and a program that keeps its data.

## What Changes

- A start restores the files the machine has, instead of discarding them. A
  program's `LOAD` is served what earlier runs saved.
- Resetting the machine no longer discards the files, and neither does the
  emulator pane being unmounted.
- Files survive reloading the IDE, and their tabs are back on screen before the
  first run of the new session.
- Files belong to the machine that wrote them: only that machine's files are
  restored and shown.
- Files belong to the browser tab that produced them. A second tab of the IDE
  keeps its own set: it is neither shown nor served another tab's files, and
  nothing it does destroys them.
- Switching target machine still discards, and so does opening, creating or
  importing a different program — unchanged.
- Discarding a data file's tab asks the user to confirm first, and then removes
  the file permanently. **BREAKING** for the user's expectations rather than for
  any interface: a delete is no longer something the next run undoes.
- What the IDE mounts for a program to load — the document's own memory blocks
  and imported tape files — is never kept, so it can never come back as if the
  program had written it.
- The standalone player keeps its files in memory only: a share link opened in
  another tab must not touch what the IDE has stored.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: "Programs can save and load their own files" — the lifetime
  rule inverts. Files are kept for the machine that wrote them and served back
  to later runs and later sessions, rather than discarded on every start, reset
  and reload.
- `code-editor`: "Saved data files appear as tabs" — discarding a saved file's
  tab is confirmed first, because it is now permanent.

## Non-goals

- No change to the `Dialect` / `MachineEmulator` seam or to any machine's file
  traps: `MachineFileStore` is unchanged, and no dialect code moves.
- Files still are not part of the document: not autosaved, not written into a
  project bundle, not carried by a share link or any export, and a program
  writing one still leaves the document clean.
- No per-program (per-document) scoping. Files are per machine; two programs on
  the same machine share one set, as they would on one real cassette.
- No sharing of files between browser tabs, and no way to reach one tab's files
  from another. Tabs are isolated, not synchronised — a file follows the tab
  that produced it, as its document already does, and is abandoned when that tab
  is closed.
- No storage quota policy, eviction or ageing-out of old files.
- No editing of a saved file's bytes; the byte view stays read-only.

## Impact

- `src/storage/vfs/vfsStore.ts` (restore, per-machine and per-tab purge, mounted
  files never kept, memory-only mode), `src/storage/vfs/db.ts` (a stored row
  gains the tab that wrote it, which makes the file's name no longer unique on
  its own: a schema version, a composite key and a migration).
- `src/storage/settings.ts` — the browser tab's own identity, alongside the
  per-tab settings already kept there.
- `src/components/EmulatorPane.tsx` — every discard leaves the emulator
  lifecycle; the run effect restores instead.
- `src/app/store.ts` — the surviving discard points, plus the confirm-before-
  delete state; `src/App.tsx` and a new hook for the restore at boot;
  `src/main.tsx` for the player's memory-only mode.
- `src/components/EditorTabBar.tsx` and a new confirm dialog beside
  `DeleteBlockDialog`.
- Behaviour a machine inherits without changing: a Spectrum `LOAD ""` now finds
  leftover files where a first run used to find an empty deck, and a TRS-80
  `OPEN "I"` now succeeds against a previous run's file.
- Tests: `src/storage/vfs/vfsStore.test.ts`, `src/app/store.test.ts`,
  `src/app/dataBlocks.test.ts`, `e2e/persistence/saved-data-tabs.spec.ts`.
- Docs: `docs/guide/testing-programs.md`.
