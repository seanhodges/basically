## 1. The stored row gains a tab

- [x] 1.1 `src/storage/settings.ts`: the browser tab's own id — generated on
      first read, kept in `sessionStorage` only. Deliberately **not** through
      `readSessionFirst`/`writeThrough`: the localStorage backup those use would
      hand every new tab the previous tab's identity.
- [x] 1.2 `src/storage/vfs/db.ts`: `VfsFileDoc` gains `tabId`, and the
      collection takes a composite primary key over the tab id and the file name
      (both required and final) — two tabs can save the same name, so the name
      alone can no longer be the key.
- [x] 1.3 The schema change that costs: version 1, a migration strategy that
      returns null for every version 0 row (they carry no tab, and RxDB drops a
      null-migrated row before it is written, so the key change needs no special
      handling), and a dynamic import of the `migration-schema` plugin beside
      the storage and dev-mode ones. RxDB migrates the existing database in
      place — nothing removes or recreates it.
- [x] 1.4 A row the store cannot read back — no tab id, bytes that will not
      decode, a missing field — is deleted where the restore meets it, not
      skipped, so it cannot be met again on the next restore.
- [x] 1.5 The reclaim of rows whose tab is gone: a last-seen registry of tab ids
      in localStorage, refreshed at boot and while the tab writes; at boot, drop
      entries past the cutoff and purge the rows of tab ids the registry no
      longer vouches for. Nothing at unload — browsers do not reliably deliver
      it. Pick a cutoff in days, and say why in a comment.

## 2. The file store

- [x] 2.1 `src/storage/vfs/vfsStore.ts`: `setDialect(id)` as the one writer of
      the store's machine id (the tab id is read once at construction and never
      changes), and `clear()` scoping its purge to this tab and that machine
      instead of removing the whole collection. `clear(next)` keeps its two jobs
      — empty memory, purge the mirror — but purges the machine being left
      before it re-tags.
- [x] 2.2 `hydrate(dialectId): Promise<void>`: merge the rows for this tab and
      machine into memory, oldest save first, keeping the in-memory entry on
      a name collision, then notify. Queue it at the tail of the same `pending`
      chain the mirror writes use — a queued purge from an earlier `clear()` must run
      first — and re-check the generation before applying what it read. It must
      never reject (warn and resolve, as `mirror` and `clear` do) and must race
      a short timeout so a slow or blocked IndexedDB cannot hold up a run.
- [x] 2.3 Mounted saves are never persisted: a `save` marked `mounted` mirrors as
      a **removal** of any row under that name, not as a skipped write, so a
      previous run's row cannot survive under a name the IDE has now mounted.
- [x] 2.4 `clearMounted()`: drop the mounted entries from memory only — no
      purge, no generation bump — for the run effect to call before the machine
      re-mounts what it needs.
- [x] 2.5 Memory-only mode (`setPersistence(false)` or equivalent): the mirror,
      the purge and `hydrate` all become no-ops. For the player.
- [x] 2.6 Rewrite the module's header comment: the lifetime rules it states are
      now the opposite of the truth. Rewrite the cross-tab note at the top of
      `src/storage/vfs/db.ts` too — it says a clear in one tab empties another's
      mirror, which the tab key is what stops.

## 3. Tests for the store

- [x] 3.1 `src/storage/vfs/vfsStore.test.ts`: hydrate merges rows into memory;
      the in-memory entry wins a name collision; `list()` order is still oldest
      first after a hydrate; only the current machine's rows are restored.
- [x] 3.2 Tab isolation, against one shared in-memory storage: two stores with
      different tab ids save the same file name; each restores only its own
      bytes, and a `clear()` in one leaves the other's rows untouched. The
      composite key is what this proves — a name-keyed row would lose one of the
      two saves outright.
- [x] 3.3 The reclaim: rows of a tab id the registry no longer vouches for are
      purged at boot, and rows of a tab it does vouch for survive.
- [x] 3.4 A row that cannot be read back is deleted rather than skipped: the
      restore that meets it leaves the collection without it, and the rest of
      the tab's files still land.
- [x] 3.5 The two ordering traps, which are the ones worth having: a `clear()`
      issued while a hydrate is in flight wins (nothing comes back), and a
      `clear()` followed by a `hydrate()` on the same machine returns empty —
      the queued purge must land first.
- [x] 3.6 A mounted save writes no row and removes any existing row under that
      name; `clearMounted()` drops mounted entries and leaves the rest.
- [x] 3.7 Hydrate resolves rather than rejects when the collection cannot be
      opened, and memory-only mode neither reads nor writes the database.

## 4. The emulator lifecycle stops clearing

- [x] 4.1 `src/components/EmulatorPane.tsx`: remove all four `emulatorVfs.clear()`
      calls (run, reset, unmount, machine/ROM change).
- [x] 4.2 In the run effect, `await emulatorVfs.hydrate(dialect.id)` — placed
      before the existing `cancelled` / machine-identity guard so that guard
      stays the last thing before `loadProgram` — then `clearMounted()`
      immediately before `loadProgram`, which re-mounts the document's blocks
      and tape files on top.
- [x] 4.3 Check the comments this invalidates: the run effect's "a start empties
      the virtual filesystem", the reset effect's "clear the VFS like a start",
      and `src/dialects/trs80/interpreter/seqfiles.ts`'s note that a reset finds
      a cleared store.

## 5. Restoring at boot, and the player

- [x] 5.1 A hook in `src/app/` that tags the store with the current machine and
      restores its files once at startup, wired into `src/App.tsx` beside
      `useOpenShared`. Deferred (idle callback), so it never delays first paint.
- [x] 5.2 `src/main.tsx`: put the store in memory-only mode on the player route,
      before the render, so a share link neither keeps its own files nor
      disturbs the IDE's.
- [x] 5.3 Confirm the surviving discard points in `src/app/store.ts` still tag
      the store with the new machine: the machine switch, the player boot, a
      named `replaceDocument`, and `loadUnsavedDocument`.

## 6. Confirming a discard

- [x] 6.1 Store: `pendingDeleteDataFile`, `requestDeleteDataFile(name)` (which
      checks the file still exists, as `requestRemoveBlock` does),
      `confirmDeleteDataFile()` (delete, and fall back to the program's tab in
      the same commit if that file was showing) and `cancelDeleteDataFile()`.
- [x] 6.2 Null `pendingDeleteDataFile` everywhere `pendingDeleteBlockId` is
      nulled — enumerate them from the tree — or a stale dialog will offer to
      delete a file that went with the previous document.
- [x] 6.3 `DeleteDataFileDialog` on the `DeleteBlockDialog` pattern (same CSS
      module, rendered unconditionally from `App.tsx`, hides on a null), saying
      the file is gone for good.
- [x] 6.4 `src/components/EditorTabBar.tsx`: the data tab's Delete item calls
      `requestDeleteDataFile`; drop the inline delete, and correct the header
      comment that calls it unconfirmed because the next run recreates the file.

## 7. Tests for the app

- [x] 7.1 `src/app/store.test.ts`: the surviving discard points still discard
      and re-tag; the confirm/cancel actions; the pending name clearing with the
      document. The existing describe-block preamble states that a run start and
      a reset purge the files, and points at `e2e/persistence/` for the proof —
      both are now false and must be rewritten, not just re-asserted.
- [x] 7.2 `src/app/dataBlocks.test.ts`: restored files project into tabs, and
      restored mounted entries never do.
- [x] 7.3 `src/dialects/fileIo.test.ts`: the cross-run guarantee, per machine.
      Every dialect that claims `capturesDataFiles` — that is, every machine not
      excused by `NO_DATA_FILE_TRAPS` — runs a load-only probe on a second
      `loadProgram` against the store the first run filled, and must read the
      earlier run's file back out of it without writing to the store. No
      machine's code changed to gain this, which is exactly why nothing in a
      machine would fail if one stopped answering out of a store it did not fill
      itself.

## 8. Docs

- [x] 8.1 `docs/guide/testing-programs.md`, "Reading the data your program
      saved": the paragraph beginning "A saved file outlives the run that wrote
      it" says files go with the next run, with a reset, and do not survive a
      reload. Rewrite it for the lifetime the specs now state — including that a
      file belongs to the browser tab that produced it and is abandoned when
      that tab closes, so downloading is the way to keep one — and say that
      Delete asks first and is permanent.

## 9. Quality gates

- [x] 9.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
      (`npm run format` to fix), and `npm run docs:build` for the docs edit.
- [x] 9.2 `npm run e2e:chromium -- e2e/persistence e2e/code-editor`. Rework the
      final stage of `e2e/persistence/saved-data-tabs.spec.ts` inside the
      journey that is already there rather than adding a cold test: "Running
      again starts clean" becomes the round trip — the second run loads the file
      back and the tab is still there — and the assertion that the document's
      mounted block never appears as a tab stays, because it is now the guard
      against a restore resurrecting it. Add the confirm-then-delete step to the
      same journey. Leave this task unchecked with a note if the run fails.
