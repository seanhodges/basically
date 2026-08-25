## 1. Buffer history snapshots

- [ ] 1.1 Add `src/editor/bufferHistory.ts`: snapshot a view's state with
      `toJSON({ history: historyField })`, restore one with
      `fromJSON(json, { extensions }, { history: historyField })`, and hold
      snapshots in a keyed cache with per-key drop and a full clear.
- [ ] 1.2 Make restore fall back to a fresh state built from the buffer's
      current text when a snapshot is missing or cannot be restored, so a bad
      snapshot costs history and never the buffer.
- [ ] 1.3 Add `src/editor/bufferHistory.test.ts`: a round trip preserves
      document, selection and undo depth; a restored state undoes to its own
      prior text; two keys never see each other's history; a corrupt snapshot
      falls back rather than throwing.

## 2. Shared editor commands

- [ ] 2.1 Add `src/editor/editorCommands.ts` holding the view-generic Edit-menu
      commands moved out of `CodeMirrorHost`: undo, redo, cut, copy, paste,
      find, close-find — including the clipboard write fallback and the
      paste-permission message. Renumbering stays in `CodeMirrorHost`.
- [ ] 2.2 Rework `CodeMirrorHost` to run the shared commands plus its own
      renumber cases, with no behaviour change while the BASIC tab is showing.
- [ ] 2.3 Add `src/editor/editorCommands.test.ts` driving each command against a
      headless `EditorView`, including cut refusing to delete when the clipboard
      write fails.

## 3. Per-buffer state in the BASIC editor

- [ ] 3.1 Extract the inline extension array in `CodeMirrorHost`'s mount effect
      into a builder function used by both the mount path and every restore.
- [ ] 3.2 Give `CodeMirrorHost` the id of the buffer it is showing; on a change,
      snapshot the outgoing buffer and `view.setState` the incoming one.
- [ ] 3.3 Have `Workspace` pass that buffer id from the active tab.
- [ ] 3.4 Stop `withActiveTab` in `src/app/store.ts` pushing text through the
      document-override channel; it only sets the active tab now.
- [ ] 3.5 Drop a buffer's snapshot wherever that buffer's content is replaced,
      and clear the cache on whole-document replacement — file open, unsaved
      load, sample load, player boot, machine switch — so undo cannot reach
      across an Open.
- [ ] 3.6 Extend `src/app/store.test.ts`: switching tabs no longer bumps the
      override sequence, document replacement still does, and the tab-changing
      callers (adding a block, writing a listing-backed block back) still leave
      the program's text correct.

## 4. Per-block state in the assembly editor

- [ ] 4.1 Stop keying `AsmEditor` by block id in `Workspace`, and swap block
      state through the same snapshot cache on a block change — flushing any
      pending assemble and resetting the per-block refs (pending timer,
      last-written bytes, reseed guard) as unmounting does today.
- [ ] 4.2 Subscribe `AsmEditor` to the edit-command channel, acting only while a
      block tab is showing, and make `CodeMirrorHost` stand down in that case.
- [ ] 4.3 Add search to `AsmEditor`'s extensions and mirror the find-panel open
      state into the store the way `CodeMirrorHost` does; close the panel on a
      tab switch.
- [ ] 4.4 Apply the external-bytes re-seed so it does not enter history.
- [ ] 4.5 Drop a block's snapshot when the block is deleted.

## 5. Toolbar

- [ ] 5.1 Disable Renumber, Renumber file and Procedures in both the desktop
      Edit menu and the mobile overflow menu while a block tab is showing.
- [ ] 5.2 Add a colocated test that the BASIC-only entries are unavailable on a
      block tab and available on the BASIC and scratch tabs.

## 6. Quality gates

- [ ] 6.1 Extend the existing undo/redo journey in
      `e2e/code-editor/editor-shortcuts.spec.ts` rather than adding a cold spec:
      type in the program, switch to a scratch buffer, type, undo — the scratch
      buffer undoes its own text and the program is untouched; switch back and
      the program's text and undo depth survived.
- [ ] 6.2 Add one scenario under `e2e/memory-blocks/` — browser-only because it
      needs real focus routing and the real toolbar menu: edit a code block's
      assembly, invoke Undo from the Edit menu, the assembly reverts and the
      BASIC program is unchanged; switch away and back and the block's history
      is still there.
- [ ] 6.3 Run `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [ ] 6.4 Run `npm run e2e:chromium -- e2e/code-editor` and
      `npm run e2e:chromium -- e2e/memory-blocks`. Check off only when both
      pass; on a failure leave this unchecked with a note on what failed.
