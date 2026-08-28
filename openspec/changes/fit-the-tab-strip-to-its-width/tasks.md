## 1. Tab identity and recency

- [x] 1.1 In `src/app/store.ts`, add `tabKey(tab: ActiveTab): string` beside
      `activeBlockIdOf` / `editorBufferOf` — `basic`, `block:<id>`,
      `scratch:<id>`, `data:<name>`. `ActiveTab` is a union with no single id, and
      recency and the fit selector both need one key per tab.
- [x] 1.2 Add transient state `tabTouchedAt: Readonly<Record<string, number>>`
      (initial `{}`), cleared wherever `activeTab` already resets to `BASIC_TAB` on
      a document change. Never autosaved, never in the project bundle.
- [x] 1.3 Stamp `Date.now()` at **every** site that writes `activeTab`, not only
      `setActiveTab` — creating a scratch buffer or a block activates it, which is
      what makes a new tab read as new, and the fall-back-to-BASIC fix-ups must
      stamp too. **Enumerate the sites from the tree** (`grep -n 'activeTab:'`);
      do not trust a list written ahead of time.
- [x] 1.4 Prune a tab's stamp where its tab is destroyed and the code is already
      there (`closeScratchBuffer`, `removeBlock`). A stale stamp is harmless —
      the selector only ranks tabs it is handed — so this is tidiness, not
      correctness.
- [x] 1.5 Tests in `src/app/store.test.ts`: activating stamps; creating a buffer
      and creating a block stamp; closing prunes; a document reset clears.

## 2. The fit selector

- [x] 2.1 New `src/app/tabOverflow.ts` holding the whole decision as a pure
      function: given the strip's tabs in their own order, their measured widths,
      the recency stamps, the bar's width and the widths of the trailing buttons,
      return which tabs are shown and which overflow. No React, no DOM.
- [x] 2.2 The rule, in order: BASIC is always admitted; rank the rest by stamp
      (a saved file with no stamp ranks by its own `updatedAt`), ties broken by the
      strip's order; admit in rank order while the running width fits, stopping at
      the first tab that does not fit rather than looking for a narrower one;
      admit no more than the bounded share of saved files.
- [x] 2.3 Two passes: compute the fit without room for the overflow button, and if
      anything overflowed, recompute with it. The button needs room only when it
      exists.
- [x] 2.4 Return the shown tabs in the strip's own order, not in rank order.
- [x] 2.5 Tests in `src/app/tabOverflow.test.ts`: everything fits and there is no
      overflow; BASIC survives a budget too small for anything else; a recently
      used tab beats an older one of the same width; the active tab is always
      shown; the two-pass reservation (a set that fits exactly until the overflow
      button needs room); the saved-file bound holding against a flood of very
      recent files; an untouched document opening to its first tabs in order.

## 3. The strip measures itself

- [x] 3.1 `src/components/EditorTabBar.module.css`: `.tabBar` stops scrolling
      (`overflow-x: auto` → `overflow: hidden`) and becomes a positioning context
      for the measurer.
- [x] 3.2 Render a hidden ghost copy of every tab's label markup inside the bar —
      same classes so the metrics match, absolutely positioned and
      `visibility: hidden` so it costs no layout, `aria-hidden` with no role and
      not focusable so the real `role="tablist"` gains no duplicate tabs. Read each
      entry's width in a layout effect into a map keyed by tab.
- [x] 3.3 Observe the bar's width with a `ResizeObserver`.
- [x] 3.4 Feed widths, recency and bar width to the selector and render the shown
      tabs with the existing per-kind markup unchanged — glyphs, `aria-selected`,
      the context menu, long-press, the scratch rename input.
- [x] 3.5 Replace the `+N` button's action: instead of opening the dialog it
      anchors a menu under itself, mirroring the `+` add-tab button's existing
      `getBoundingClientRect` + `useDismiss` pattern. `role="menu"`, one
      `role="menuitem"` per hidden tab with its kind glyph and name, click
      activates the tab and closes; `aria-haspopup` / `aria-expanded` on the
      button, and a second click closes it.
- [x] 3.6 Rewrite the component's block comments describing the old saved-file
      bound and naming the dialog.

## 4. Remove the dialog

- [x] 4.1 Delete `src/components/VfsInspectorDialog.tsx` and
      `VfsInspectorDialog.module.css`.
- [x] 4.2 Delete `src/storage/vfs/hexdump.ts` and its test — no other caller; the
      data tab's byte view is its own component. Confirm before deleting.
- [x] 4.3 Delete `src/app/vfsEmptyState.ts` and its test — no other caller.
      `Dialect.capturesDataFiles` **stays**: `src/dialects/fileIoProbes.ts` and
      `fileIo.test.ts` read it.
- [x] 4.4 Unwire `vfsInspectorOpen` / `setVfsInspectorOpen` end to end: the render
      in `src/App.tsx`, the four sites in `src/app/store.ts`, the
      `view.vfsInspector` shortcut id and definition in `src/app/shortcuts.ts`, its
      case in `src/app/useGlobalShortcuts.ts`, the `vfs` entry in
      `src/app/surfaces.ts`, and both toolbar menu entries with the separator left
      orphaned by the File one.
- [x] 4.5 Update the tests that enumerate surfaces generically —
      `src/app/surfaces.test.ts` and `src/app/historyNav.test.ts` — and check
      `src/app/shortcuts.test.ts`.

## 5. Copy that names the dialog

- [x] 5.1 Repoint the Atom's `BPUT` and `FOUT` text at the editor tab, in both
      `src/dialects/atom/keywords.ts` and `src/reference/atom.ts`.
- [x] 5.2 Repoint the C64 AI profile's sentence about where saved files appear.
- [x] 5.3 Repoint the REM line in `src/dialects/atom/samples/files.bas`; check
      `samples.test.ts` and `sampleConventions.test.ts` do not pin it.

## 6. Docs

- [x] 6.1 Document the fit rule once, in `docs/guide/writing-basic.md` where the
      strip is already described: as many tabs as there is room for, the program's
      tab always first, most recently used next, and a count button at the end
      listing the rest.
- [x] 6.2 Link that rule from `docs/guide/machine-code.md`'s tab-strip sentence
      rather than restating it.
- [x] 6.3 In `docs/guide/testing-programs.md`, replace the "File ▸ Emulator files"
      paragraph with the link, dropping the hex-dump and column detail that
      belonged to the dialog. Ensure the page still says which machines capture
      the files a program saves — the fact the dialog's empty state used to carry.
- [x] 6.4 Remove the emulator-files row from `docs/guide/keyboard-shortcuts.md`,
      the viewer aside from `docs/reference/atom.md`, and the inspector from the
      dialog list in `docs/contributing/architecture.md`.

## 7. Quality gates

- [x] 7.1 `npm run typecheck` — `noUnusedLocals` is the signal that a
      `vfsInspectorOpen` reference was missed.
- [x] 7.2 `npm test`
- [x] 7.3 `npm run lint` and `npm run format:check`
- [x] 7.4 `npm run docs:build` — `docs/` changed.
- [x] 7.5 **Not done, deliberately.** Extending
      `e2e/persistence/saved-data-tabs.spec.ts` would mean five more Spectrum tape
      saves, each waiting on its own ROM prompt, on a journey already budgeted at
      90 s — and it would prove nothing 7.6 does not: the same measurement, the
      same overflow menu, the same reinstatement, at a fraction of the minutes.
      The saved-file bound itself needs no browser and is pinned in
      `src/app/tabOverflow.test.ts`.
- [x] 7.6 Add a width-driven case to `e2e/code-editor/scratch-buffers.spec.ts` (no
      machine boot needed): open several buffers, shrink the viewport, and assert
      tabs move into the overflow while BASIC stays.
- [x] 7.7 `npm run e2e:chromium -- e2e/persistence e2e/code-editor`: 29 passed,
      3 failed. All three failures reproduce unchanged on the base commit (checked
      in a worktree at `HEAD~1`), so none is this change's:
      `completion-abbreviation.spec.ts` x2 and `boot-storage.spec.ts`'s
      "welcome dialog, empty editor, no console errors", all timing out waiting
      for an element on `page.goto('/')`. Every spec touching the tab strip
      passes, `saved-data-tabs.spec.ts` and the new overflow case included.
