## 1. Sequencing

- [x] 1.1 Archive `edit-block-bytes` (implemented, 23/23) so its *Blocks are
      editable as bytes* requirement is in the baseline before this change's
      specs are synced. Done: archived as `2026-08-27-edit-block-bytes`, and
      this change's `memory-blocks` delta now carries that requirement reworded
      from "a data block" to "a memory block", so the rename travels with the
      change that makes it rather than being smuggled into an archive.

## 2. The kind rename (behaviour-free, its own commit)

- [x] 2.1 In `src/dialects/types.ts`, split `MemoryBlock` into a discriminated
      union: `CodeBlock` (`kind: 'code'`, address) and `MemoryBlock`
      (`kind: 'memory'`, address), with `export type Block = CodeBlock | MemoryBlock`.
- [x] 2.2 Rename references across `src/app/store.ts`, `blockLint.ts`,
      `blockEdit.ts`, `listingBlocks.ts`, `listingBlockEdit.ts`,
      `sampleBlocks.ts`, `src/dialects/importBlocks.ts` and the per-dialect
      detokenizers so `MemoryBlock` becomes `Block` where the whole union is
      meant, and `kind: 'data'` becomes `kind: 'memory'`.
- [x] 2.3 Update `BlockSettingsDialog.tsx` so the kind choice reads code/memory,
      and `EditorTabBar.tsx` so the `▤` tab tooltip says "memory block".
- [x] 2.4 Map a stored `'data'` kind to `'memory'` on read in
      `src/storage/projectFile.ts` (`parseBlocks`), the autosave reader in
      `src/storage/settings.ts`, and `src/share/shareClient.ts`; make sure
      nothing writes `'data'` for a block again.
- [x] 2.5 Tests: a project `.zip`, an autosave payload and a share payload each
      holding `kind: 'data'` reopen as `'memory'` at their original address with
      bytes unchanged (colocated with each reader).
- [x] 2.6 `npm run typecheck && npm test` green with no behaviour change beyond
      the dialog's labels.

## 3. The container seam

- [x] 3.1 Add the optional `Dialect` member declaring how a stored file splits
      into payload and container (`unwrap` only — no `wrap` in this change),
      with absent meaning the stored bytes are the payload.
- [x] 3.2 Implement it for `zxspectrum` and `zxspectrum128`, splitting the
      stored two-block tape image into its 17-byte header and its data, reusing
      `tapBlockScan` / `headerName` from `src/dialects/zxspectrum/tapfile.ts`.
- [x] 3.3 Colocated tests: a stored tape image yields the payload and the header
      for each of the number-array, character-array and code header types; and a
      dialect that declares nothing returns its stored bytes unchanged.
- [x] 3.4 Registry-driven test over every dialect declaring the member, in the
      shape of `src/dialects/memoryActivity.test.ts`, naming its exemptions with
      a reason — the conformance test the file-store parameter never had.

## 4. Lifetime

- [x] 4.1 Remove the `emulatorVfs.clear()` on the stop path in
      `src/components/EmulatorPane.tsx` so saved files outlive the run; leave
      the start, reset, unmount and dialect-switch clears exactly as they are.
- [x] 4.2 Verify each document-replacing path (`createProject`, `openProject`,
      `replaceDocument`, import, `playerBoot`, `openSharedInIde`) actually
      reaches a clear now that files outlive the machine, and add the clear
      where it only happened via a running machine before.
- [x] 4.3 Tests in `src/storage/vfs/vfsStore.test.ts` and alongside the store:
      one assertion per lifetime rule — a stop keeps the files; a run start, a
      reset, a machine change and each document-replacing action purge them; a
      breakpoint pause keeps them. The machine's own rules (stop keeps, start
      and reset purge, a pause keeps) live in `EmulatorPane` and are proved in
      the browser by the spec task 8.6 adds; the store tests cover the
      document-replacing actions and the machine change.

## 5. The projection

- [x] 5.1 New `src/app/dataBlocks.ts`: a pure `projectDataBlocks(entries, unwrap)`
      mapping file-store entries and their bytes to `DataBlock[]`, memoized on
      the store snapshot the way `selectBlocks` memoizes listing blocks.
- [x] 5.2 Wire it to React with `useSyncExternalStore` over the existing
      `emulatorVfs.subscribe`, throttling the snapshot so a program writing
      per-frame does not re-render per frame. Nothing in this path may await,
      and nothing may set `dirty`.
- [x] 5.3 Colocated `src/app/dataBlocks.test.ts`: the projection, its
      memoization (a snapshot with no change returns the same array), and the
      unwrap being applied per entry.

## 6. Tabs and the byte view

- [x] 6.1 Add `{ kind: 'data'; name: string }` to `ActiveTab` in
      `src/app/store.ts`, keyed by name; a tab whose file is gone falls back to
      the BASIC tab, as a stale block id already does.
- [x] 6.2 Render data tabs in `EditorTabBar.tsx` after the blocks, with their own
      glyph, bounded to a fixed count with the rest reachable through the
      Emulator files dialog.
- [x] 6.3 Give `ByteEditor.tsx` a `readOnly` mode and an offset gutter (no
      address), and accept a data block as well as a block; route data tabs to it
      from `Workspace.tsx`. No new buffer-history key — a read-only view has no
      history.
- [x] 6.4 Add **Download .bin**, **Download .txt** and **Delete** to the data
      tab's context menu, beside the entries a block tab already offers; Delete
      is a store delete by name.
- [x] 6.5 Decode `.txt` through the machine's own charset (the mapping the byte
      view's character column already uses), not ASCII.
- [x] 6.6 Colocated test for the `.txt` decode over a TRS-80 `PRINT#` file's
      bytes, and for the download filenames.
- [x] 6.7 Repoint `VfsInspectorDialog.tsx` at the projected data blocks so it is
      the tab strip's overflow surface rather than a second list of the same
      files.

## 7. Documentation

- [x] 7.1 Update `docs/guide/testing-programs.md` where it describes the
      Emulator files dialog, so it reflects files appearing as tabs and
      surviving the machine stopping.
- [x] 7.2 Update `docs/contributing/architecture.md` for the container seam and
      the projection. Do not touch the docs sidebar.

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format`)
- [x] 8.5 `npm run docs:build` (docs/ changed in group 7)
- [x] 8.6 E2E for the affected capabilities, Chromium only:
      `npm run e2e:chromium -- e2e/persistence e2e/code-editor e2e/memory-blocks`.
      Add one browser spec in `e2e/persistence/`: boot the Spectrum, run a
      `SAVE … DATA`, assert the tab appears live showing the payload rather than
      the tape header, stop the machine and assert the tab survives and still
      shows it, then Run again and assert it is gone. Check this task off only
      when the run passes; if it fails, leave it unchecked with a note on what
      failed. Done: `e2e/persistence/saved-data-tabs.spec.ts`; the three
      capability folders pass Chromium-only (45 tests), which also took
      `zx81-listing-blocks.spec.ts`'s Kind selection from `data` to `memory`.
