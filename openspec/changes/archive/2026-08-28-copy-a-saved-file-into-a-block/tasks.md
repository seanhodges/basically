## 1. Deriving a block name from a file name

- [x] 1.1 Add `blockNameFromFileName(fileName, taken)` to `src/app/blockEdit.ts`:
      strip characters a block name cannot hold, ensure a leading letter, fall
      back to a fixed stem when nothing usable remains, then take the first free
      name against `taken` (the same first-free rule `addBlock` uses).
- [x] 1.2 Cover it in `src/app/blockEdit.test.ts`: a plain name passes through, a
      name with spaces and punctuation, one starting with a digit, one made only
      of graphics characters, an empty name, and de-duplication against names
      already in the document.

## 2. Store

- [x] 2.1 `addBlock(kind: Block['kind'] = 'code')` in `src/app/store.ts`: seed a
      `'memory'` block with a single zero byte and no assembly source, keeping
      the existing code path (return stub assembled as both bytes and source)
      for `'code'`. Update its `IdeActions` doc comment.
- [x] 2.2 On the listing-backed path, record the requested kind in
      `listingBlockMeta` for the inserted record, so a listing block created as
      bytes opens on its bytes.
- [x] 2.3 Add `addBlockFromDataFile(name)`: resolve the file through the data
      block projection, derive the block's name (1.1), build a `'memory'` block
      at the dialect's default address holding a copy of the file's bytes, and
      in one update select its tab and open its settings. No-op when the file is
      gone or the dialect has no fixed-address blocks. Document it in
      `IdeActions`.
- [x] 2.4 Cover both in `src/app/store.test.ts`: the created binary block's kind,
      single zero byte and absent assembly source; the listing path's recorded
      kind; and for the copy - bytes equal to the projection and not aliasing it,
      the name derived from the file's, the active tab and open settings, `dirty`
      set, and the no-ops.

## 3. UI

- [x] 3.1 `src/components/EditorTabBar.tsx`: split the `+` menu's "New machine
      code block" into "New assembly block" and "New binary block", passing the
      kind to `addBlock`, and update the plus button's `title` to match.
- [x] 3.2 Add "Copy to a binary block" to a saved data file's tab menu, above the
      separator that holds Delete.
- [x] 3.3 `src/components/BlockSettingsDialog.tsx`: rename the Kind options to
      "Assembly" (`code`) and "Binary" (`memory`), and follow the summary line
      above them so the dialog names each kind one way. Option values unchanged.

## 4. Browser coverage

- [x] 4.1 Update `e2e/helpers.ts`'s new-block helper to click "New assembly
      block", and the menu-item name where the `e2e/memory-blocks/` specs
      mention it.
- [x] 4.2 Extend the journey in `e2e/persistence/saved-data-tabs.spec.ts` (rather
      than booting a second machine): after its "survives the stop" stage, copy
      `SCORES` into a block and assert the settings dialog is on the new block,
      the block tab holds the same bytes, and the data tab is still there; the
      existing final Run stage then also asserts the block survives while the
      data tab goes. Comment why a memory-blocks scenario rides on a persistence
      journey - the file has to come from a real run, and that boot is the cost.
- [x] 4.3 Fold one assertion into the existing `e2e/memory-blocks/block-tabs.spec.ts`
      journey: "New binary block" opens the byte editor rather than the assembly
      editor. No new cold `page.goto('/')`.

## 6. Only what the program wrote appears as a tab

- [x] 6.1 `src/dialects/types.ts`: `MachineFileEntry` gains a flag saying the
      entry was mounted by the IDE rather than written by the program, and
      `MachineFileStore.save`'s `meta` gains the same. Document both.
- [x] 6.2 `src/storage/vfs/vfsStore.ts`: hold the flag on the stored file and
      emit it from `list()`. Not mirrored into RxDB - that would cost a schema
      version for a reader that does not exist.
- [x] 6.3 `src/app/dataBlocks.ts`: `projectDataBlocks` skips a mounted entry.
- [x] 6.4 `src/dialects/zxspectrum/emulator/tapeDeck.ts`: `addFile` marks what
      it mounts, so both Spectrums' blocks and their imported tape files are
      covered by the one path.
- [x] 6.5 Cover it: `projectDataBlocks` drops a mounted entry and keeps the rest
      (`src/app/dataBlocks.test.ts`); the store round-trips the flag and a
      program's save over a mounted name clears it
      (`src/storage/vfs/vfsStore.test.ts`); `addFile` marks it and the deck
      still serves what it mounted
      (`src/dialects/zxspectrum/emulator/tapeDeck.test.ts`).
- [x] 6.6 Assert it in the browser: the `e2e/persistence/saved-data-tabs.spec.ts`
      journey's final stage shows one tab for the copied block, not two.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check` (or `npm run format`)
- [x] 5.5 `npm run e2e:chromium -- e2e/memory-blocks`
- [x] 5.6 `npm run e2e:chromium -- e2e/persistence`
- [x] 5.7 `npx openspec validate --specs`
