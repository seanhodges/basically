## 1. The file store

- [ ] 1.1 `src/storage/vfs/vfsStore.ts`: `setDialect(id)` as the one writer of
      the store's machine id, and `clear()` scoping its purge to that machine
      instead of removing the whole collection. `clear(next)` keeps its two jobs
      — empty memory, purge the mirror — but purges the machine being left
      before it re-tags.
- [ ] 1.2 `hydrate(dialectId): Promise<void>`: merge the rows for that machine
      into memory, oldest save first, keeping the in-memory entry on a name
      collision, then notify. Queue it at the tail of the same `pending` chain
      the mirror writes use — a queued purge from an earlier `clear()` must run
      first — and re-check the generation before applying what it read. It must
      never reject (warn and resolve, as `mirror` and `clear` do) and must race
      a short timeout so a slow or blocked IndexedDB cannot hold up a run.
- [ ] 1.3 Mounted saves are never persisted: a `save` marked `mounted` mirrors as
      a **removal** of any row under that name, not as a skipped write, so a
      previous run's row cannot survive under a name the IDE has now mounted.
- [ ] 1.4 `clearMounted()`: drop the mounted entries from memory only — no
      purge, no generation bump — for the run effect to call before the machine
      re-mounts what it needs.
- [ ] 1.5 Memory-only mode (`setPersistence(false)` or equivalent): the mirror,
      the purge and `hydrate` all become no-ops. For the player.
- [ ] 1.6 One-time purge of the collection on first use of the new code,
      recorded with the IDE's other browser settings, so rows written under the
      old regime (including mounted ones) never surface as tabs.
- [ ] 1.7 Rewrite the module's header comment: the lifetime rules it states are
      now the opposite of the truth. Update the cross-tab note at the top of
      `src/storage/vfs/db.ts` too — durable data makes that limitation real.
      No schema change: the collection stays at version 0.

## 2. Tests for the store

- [ ] 2.1 `src/storage/vfs/vfsStore.test.ts`: hydrate merges rows into memory;
      the in-memory entry wins a name collision; `list()` order is still oldest
      first after a hydrate; only the current machine's rows are restored.
- [ ] 2.2 The two ordering traps, which are the ones worth having: a `clear()`
      issued while a hydrate is in flight wins (nothing comes back), and a
      `clear()` followed by a `hydrate()` on the same machine returns empty —
      the queued purge must land first.
- [ ] 2.3 A mounted save writes no row and removes any existing row under that
      name; `clearMounted()` drops mounted entries and leaves the rest.
- [ ] 2.4 Hydrate resolves rather than rejects when the collection cannot be
      opened, and memory-only mode neither reads nor writes the database.

## 3. The emulator lifecycle stops clearing

- [ ] 3.1 `src/components/EmulatorPane.tsx`: remove all four `emulatorVfs.clear()`
      calls (run, reset, unmount, machine/ROM change).
- [ ] 3.2 In the run effect, `await emulatorVfs.hydrate(dialect.id)` — placed
      before the existing `cancelled` / machine-identity guard so that guard
      stays the last thing before `loadProgram` — then `clearMounted()`
      immediately before `loadProgram`, which re-mounts the document's blocks
      and tape files on top.
- [ ] 3.3 Check the comments this invalidates: the run effect's "a start empties
      the virtual filesystem", the reset effect's "clear the VFS like a start",
      and `src/dialects/trs80/interpreter/seqfiles.ts`'s note that a reset finds
      a cleared store.

## 4. Restoring at boot, and the player

- [ ] 4.1 A hook in `src/app/` that tags the store with the current machine and
      restores its files once at startup, wired into `src/App.tsx` beside
      `useOpenShared`. Deferred (idle callback), so it never delays first paint.
- [ ] 4.2 `src/main.tsx`: put the store in memory-only mode on the player route,
      before the render, so a share link neither keeps its own files nor
      disturbs the IDE's.
- [ ] 4.3 Confirm the surviving discard points in `src/app/store.ts` still tag
      the store with the new machine: the machine switch, the player boot, a
      named `replaceDocument`, and `loadUnsavedDocument`.

## 5. Confirming a discard

- [ ] 5.1 Store: `pendingDeleteDataFile`, `requestDeleteDataFile(name)` (which
      checks the file still exists, as `requestRemoveBlock` does),
      `confirmDeleteDataFile()` (delete, and fall back to the program's tab in
      the same commit if that file was showing) and `cancelDeleteDataFile()`.
- [ ] 5.2 Null `pendingDeleteDataFile` everywhere `pendingDeleteBlockId` is
      nulled — enumerate them from the tree — or a stale dialog will offer to
      delete a file that went with the previous document.
- [ ] 5.3 `DeleteDataFileDialog` on the `DeleteBlockDialog` pattern (same CSS
      module, rendered unconditionally from `App.tsx`, hides on a null), saying
      the file is gone for good.
- [ ] 5.4 `src/components/EditorTabBar.tsx`: the data tab's Delete item calls
      `requestDeleteDataFile`; drop the inline delete, and correct the header
      comment that calls it unconfirmed because the next run recreates the file.

## 6. Tests for the app

- [ ] 6.1 `src/app/store.test.ts`: the surviving discard points still discard
      and re-tag; the confirm/cancel actions; the pending name clearing with the
      document. The existing describe-block preamble states that a run start and
      a reset purge the files, and points at `e2e/persistence/` for the proof —
      both are now false and must be rewritten, not just re-asserted.
- [ ] 6.2 `src/app/dataBlocks.test.ts`: restored files project into tabs, and
      restored mounted entries never do.

## 7. Docs

- [ ] 7.1 `docs/guide/testing-programs.md`, "Reading the data your program
      saved": the paragraph beginning "A saved file outlives the run that wrote
      it" says files go with the next run, with a reset, and do not survive a
      reload. Rewrite it for the lifetime the specs now state, and say that
      Delete asks first and is permanent.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
      (`npm run format` to fix), and `npm run docs:build` for the docs edit.
- [ ] 8.2 `npm run e2e:chromium -- e2e/persistence e2e/code-editor`. Rework the
      final stage of `e2e/persistence/saved-data-tabs.spec.ts` inside the
      journey that is already there rather than adding a cold test: "Running
      again starts clean" becomes the round trip — the second run loads the file
      back and the tab is still there — and the assertion that the document's
      mounted block never appears as a tab stays, because it is now the guard
      against a restore resurrecting it. Add the confirm-then-delete step to the
      same journey. Leave this task unchecked with a note if the run fails.
