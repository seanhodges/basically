## 1. The pure modules, before any UI

- [ ] 1.1 New pure projection module: bytes + view mode (hex, characters, both) +
      bytes-per-row → the document text a row-per-line surface renders, plus the
      mapping in both directions between a document offset and a byte index.
      The mapping must also name the append position one past the last byte,
      since that is where a block grows. Everything else depends on this being
      right, so it is written and tested first. No React, no DOM.
- [ ] 1.2 New pure module for byte editing — apply a hex nibble (high then low,
      auto-advancing to the next byte), apply a typed character through the
      dialect's `CharsetMapping.toMachine`, append at the end, truncate the last
      byte, set a length (grow pads with `$00`, shrink truncates, clamped to
      `0x10000 - address`), and fill a range. Follow the shape of
      `src/app/blockEdit.ts`, which is the same idea for block metadata.
      `toMachine` throws `CharsetError` on an unrepresentable character: catch
      that specifically, rethrow anything else, and return a refusal result, so
      no caller has to handle an exception. `src/dialects/sourceUnits.ts` is the
      reference for the catch.
- [ ] 1.3 Colocated tests for both. Projection: offset↔byte round-trips in every
      mode, the boundaries either side of a row, a mode change preserving the
      caret's byte, the bytes-per-row breakpoints. Editing: nibble sequencing and
      auto-advance, entering a value at the append position, charset round-trip
      including a character the machine cannot represent, and the length edge
      cases (starting from zero-length, truncating to nothing, a set-length
      clamped at the 64 KB ceiling, and a length change surviving a round trip
      through undo).

## 2. The byte surface

- [ ] 2.1 New byte-editor component on CodeMirror, as `AsmEditor` is: the
      document is the projection from 1.1, and the address gutter is
      CodeMirror's line-number gutter with `formatNumber` rendering `formatWord`
      of the row's machine address. Read the block from the store; write with a
      fresh array — never mutate the existing `Uint8Array`, or Zustand's identity
      checks will miss the change.
- [ ] 2.2 Take ordinary text input out of the document so the surface's own
      dispatch is the only writer, and constrain the caret to byte boundaries
      with `EditorView.atomicRanges` — `binaryLineWidget.ts` and
      `controlChipWidget.ts` are the worked examples. The caret must not rest in
      the gaps between hex pairs or between the two views, and must be able to
      rest on the append position one past the last byte. This is the fiddliest
      part of the change; do it before the editing keys.
- [ ] 2.3 Editing in both views: hex digits in the hex view with any other key
      ignored, characters in the character view through the charset, with a
      visible refusal when the charset has no code for what was typed. A value
      entered at the append position grows the block; Backspace or Delete on the
      last byte truncates it, while Backspace elsewhere only moves the caret back
      a byte — both ordinary transactions, so undo reaches them. A byte
      edit is one transaction touching both views, so the views cannot drift and
      undo reverses both together.
- [ ] 2.4 Undo through `src/editor/bufferHistory.ts` under `blockBufferKey`, as
      the assembly editor does — per-block, and surviving a tab switch. Carry
      `AsmEditor`'s two disciplines: a reseed guard so re-projecting after an
      external byte change is not an undo step, and reconfiguring `Compartment`s
      on the live view, since a parked state returns with the configuration it
      was put away with.
- [ ] 2.5 On-screen keyboard: install this surface's applier into
      `editorInputRef` when a block tab is active, so keystrokes stop reaching
      the mounted-but-hidden BASIC host. `editorFocused` follows from
      `update.view.hasFocus` as it does for the other editors. Expect
      `EditorKeyAction` to need no new members — inserts and arrows already
      cover it, and the surface interprets an insert as nibble entry itself.
- [ ] 2.6 Responsive views: both side by side where there is room, tabs where
      there is not, at the app's existing narrow breakpoint (`MOBILE_QUERY` plus
      the landscape query in `src/app/useMediaQuery.ts`). Bytes-per-row steps
      with width independently of the mode. The selected tab lives in the store;
      `EditorTabBar` is the markup pattern and `MobileTabBar` the gating one.

## 3. Wire it in

- [ ] 3.1 `src/components/Workspace.tsx` — route a data block, and a code block
      whose CPU has no engine from `asmEngineFor`, to the byte editor. Keep
      `UnsupportedBlockNotice` for the one case that reaches neither surface: a
      code block on a dialect with no `memoryBlocks` capability. Its copy is
      currently written for data blocks and should be rewritten for the case it
      now owns.
- [ ] 3.2 Commit fork: `upsertBlock` for an ordinary block,
      `commitListingBlockBytes` for a listing block, exactly as `AsmEditor`
      chooses between them. Keep `AsmEditor`'s ref of the last-written array so
      the commit echoing back through the store does not re-seed the view under
      the user.
- [ ] 3.3 The byte count in the surface's status strip is an editable field
      (`AsmEditor` renders the same count as static text), committed on Enter or
      blur, for a length change too large to type. No dialog and no confirmation
      — the length change goes through the document, so undo covers it. Fill
      stays an explicit action taking an address range rather than a dragged
      selection, clamped to the block's current extent now that it is not a
      growth path.
- [ ] 3.4 `src/components/EditorTabBar.tsx` — a "Load bytes…" entry in the block
      tab context menu, beside the existing `.bin` / `.asm` downloads, using
      `openBinaryFile` from `src/storage/files.ts` (which already handles the
      picker and the fallback iOS Safari needs). It replaces the block's
      contents; the block keeps its own address, name and kind.

## 4. Tests

- [ ] 4.1 The unit tests from group 1 are the bulk of the coverage — the
      projection, the editing rules and the charset behaviour are all logic, and
      per CLAUDE.md they belong in colocated `*.test.ts`, not in a browser.
- [ ] 4.2 Replace `e2e/memory-blocks/asm-editor.spec.ts`'s "a data block shows
      the not-yet-supported placeholder" test. It pins the behaviour this change
      removes, so the same journey should assert the byte editor opens instead.
      Replaced, not deleted.
- [ ] 4.3 One e2e scenario in `e2e/memory-blocks/`, extending an existing journey
      rather than a new cold `page.goto('/')`: create a block, switch it to data,
      edit a byte, check the character view moved with it, grow the block by a
      byte at its end, switch tabs and back, reload — the edit and the new
      length persist. This pays rent because it proves the store
      round trip, the two views sharing one edit, and focus handling through a
      real browser.
- [ ] 4.4 Extend `e2e/memory-blocks/zx81-listing-blocks.spec.ts` for a listing
      block switched to data: this is the case where the commit path differs and
      the BASIC listing is rewritten underneath.
- [ ] 4.5 Do **not** add a per-machine e2e matrix for the byte editor. It is
      dialect-generic apart from the charset, and the charset behaviour is a unit
      test.

## 5. Documentation

- [ ] 5.1 `docs/guide/machine-code.md` — the sentence "a **data** block is a
      plain run of bytes with no assembly view" becomes the byte editor's
      description. Cover editing bytes, the two views and how they relate,
      growing and shrinking a block as you edit it, fill and loading from a
      file. Guide conventions: no `src/` paths,
      no internal symbols.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 6.2 `npm run docs:build` (docs/ changed in group 5).
- [ ] 6.3 `npm run e2e:chromium -- e2e/memory-blocks` and
      `npm run e2e:chromium -- e2e/code-editor` — the second because the block
      surface shares the editor pane and the on-screen keyboard's routing. Only
      check off when both pass; a failure leaves this unchecked with a note on
      what failed.
- [ ] 6.4 Manual, phone-portrait viewport: the views drop to tabs, the row drops
      to its narrow byte count, the on-screen keyboard reaches the surface, and a
      byte can actually be typed. Confirm what switching text input off costs —
      the device keyboard will not appear, which is intended but should be seen
      rather than assumed.
