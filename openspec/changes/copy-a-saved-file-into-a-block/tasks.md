## 1. Deriving a block name from a file name

- [ ] 1.1 Add `blockNameFromFileName(fileName, taken)` to `src/app/blockEdit.ts`:
      strip characters a block name cannot hold, ensure a leading letter, fall
      back to a fixed stem when nothing usable remains, then take the first free
      name against `taken` (the same first-free rule `addBlock` uses).
- [ ] 1.2 Cover it in `src/app/blockEdit.test.ts`: a plain name passes through, a
      name with spaces and punctuation, one starting with a digit, one made only
      of graphics characters, an empty name, and de-duplication against names
      already in the document.

## 2. Store

- [ ] 2.1 `addBlock(kind: Block['kind'] = 'code')` in `src/app/store.ts`: seed a
      `'memory'` block with a single zero byte and no assembly source, keeping
      the existing code path (return stub assembled as both bytes and source)
      for `'code'`. Update its `IdeActions` doc comment.
- [ ] 2.2 On the listing-backed path, record the requested kind in
      `listingBlockMeta` for the inserted record, so a listing block created as
      bytes opens on its bytes.
- [ ] 2.3 Add `addBlockFromDataFile(name)`: resolve the file through the data
      block projection, derive the block's name (1.1), build a `'memory'` block
      at the dialect's default address holding a copy of the file's bytes, and
      in one update select its tab and open its settings. No-op when the file is
      gone or the dialect has no fixed-address blocks. Document it in
      `IdeActions`.
- [ ] 2.4 Cover both in `src/app/store.test.ts`: the created binary block's kind,
      single zero byte and absent assembly source; the listing path's recorded
      kind; and for the copy - bytes equal to the projection and not aliasing it,
      the name derived from the file's, the active tab and open settings, `dirty`
      set, and the no-ops.

## 3. UI

- [ ] 3.1 `src/components/EditorTabBar.tsx`: split the `+` menu's "New machine
      code block" into "New assembly block" and "New binary block", passing the
      kind to `addBlock`, and update the plus button's `title` to match.
- [ ] 3.2 Add "Copy to a binary block" to a saved data file's tab menu, above the
      separator that holds Delete.
- [ ] 3.3 `src/components/BlockSettingsDialog.tsx`: rename the Kind options to
      "Assembly" (`code`) and "Binary" (`memory`), and follow the summary line
      above them so the dialog names each kind one way. Option values unchanged.

## 4. Browser coverage

- [ ] 4.1 Update `e2e/helpers.ts`'s new-block helper to click "New assembly
      block", and the menu-item name where the `e2e/memory-blocks/` specs
      mention it.
- [ ] 4.2 Extend the journey in `e2e/persistence/saved-data-tabs.spec.ts` (rather
      than booting a second machine): after its "survives the stop" stage, copy
      `SCORES` into a block and assert the settings dialog is on the new block,
      the block tab holds the same bytes, and the data tab is still there; the
      existing final Run stage then also asserts the block survives while the
      data tab goes. Comment why a memory-blocks scenario rides on a persistence
      journey - the file has to come from a real run, and that boot is the cost.
- [ ] 4.3 Fold one assertion into the existing `e2e/memory-blocks/block-tabs.spec.ts`
      journey: "New binary block" opens the byte editor rather than the assembly
      editor. No new cold `page.goto('/')`.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format`)
- [ ] 5.5 `npm run e2e:chromium -- e2e/memory-blocks`
- [ ] 5.6 `npm run e2e:chromium -- e2e/persistence`
- [ ] 5.7 `npx openspec validate --specs`
