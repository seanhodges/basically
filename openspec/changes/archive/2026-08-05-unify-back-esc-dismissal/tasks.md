## 1. Surface registry

- [x] 1.1 Add `src/app/surfaces.ts`: one entry per store-backed surface with
      `key`, `value(state)`, `isOpen(value)`, `apply(state, value)` and the
      mobile/desktop gating predicate. Cover the six surfaces `historyNav`
      already tracks plus settings, docs, import, transfer, share link, VFS
      inspector, outline, welcome, memory map, block settings, delete-block
      confirm, switch-target confirm, variable detail and gamepad remap.
- [x] 1.2 Point the confirm surfaces' apply-to-closed path at the existing
      `cancelRemoveBlock()` / `cancelDialectSwitch()` store actions, and block
      settings at `closeBlockSettings()`.
- [x] 1.3 Add `src/app/surfaces.test.ts` asserting every overlay flag on the
      store has a registry entry, so a future dialog cannot silently miss both
      gestures.

## 2. Lift the two component-state surfaces into the store

- [x] 2.1 Move `VariableWatcher`'s `selected` into the store; update
      `src/components/VariableWatcher.tsx` to read/write it via narrow selectors.
- [x] 2.2 Move `Workspace`'s `remapRole` into the store; update
      `src/components/Workspace.tsx` likewise.
- [x] 2.3 Register both in the surface registry.

## 3. Registry-driven history

- [x] 3.1 Rework `NavSnapshot` into a record keyed by surface id, and rewrite
      `computeSnapshot`, `snapshotsEqual`, `openKeys` and `applySnapshot` in
      `src/app/historyNav.ts` to iterate the registry. Leave the state machine
      (push/replace/go, `applyingPop`, `selfPopInFlight`, the entry stack)
      unchanged.
- [x] 3.2 Keep `isAutoShow` so an auto-shown keyboard still does not consume a
      Back press.
- [x] 3.3 Expose `hasOpenSurfaces()` from `createHistorySync`, and surface it
      from `useHistorySync` for the Escape handler.
- [x] 3.4 Extend `src/app/historyNav.test.ts` with the newly registered
      surfaces. All 10 behavioural tests (push/pop/LIFO/auto-show/balance)
      passed unchanged, confirming the state machine is untouched; 3 tests that
      asserted the snapshot's literal field names were updated, since the
      snapshot is keyed by surface id now. Confirm-cancels and welcome-persists
      are covered in `surfaces.test.ts` (they exercise the registry, not the
      history machine) and end-to-end in `e2e/shell/dismissal.spec.ts`.

## 4. Escape as Back

- [x] 4.1 Give `view.escape` a real dispatch case in
      `src/app/useGlobalShortcuts.ts`: `history.back()` when a surface is open,
      otherwise return `false` so the key passes through. Its advertised label
      ("Release emulator / close panel") becomes true.
- [x] 4.2 Call `preventDefault()` in the Escape branch of `src/app/useDismiss.ts`
      so a menu close does not also pop a history entry. Pin the contract in
      e2e, not in `useDismiss.test.ts`: the unit suite runs in the `node`
      environment with no DOM (the existing tests deliberately factor out
      `isOutside` to stay DOM-free), so a real keydown can only be exercised in
      a browser.
- [x] 4.3 Make `EmulatorPane`'s Escape branch `preventDefault()` too, so
      releasing the machine doesn't also close the surface behind it.
- [x] 4.4 Leave the `open && !pickerOpen` guard in
      `src/components/NewProjectDialog.tsx` in place. The plan called for
      removing it, but that was wrong: the picker *inside* the new-project form
      is intentionally local state (the store's `machinePickerOpen` is the
      toolbar's separate copy, because there the machine is part of a choice not
      yet applied), so it is not on the shared stack and still needs the guard.

## 5. Docs drawer iframe

- [x] 5.1 In `docs/.vitepress/theme/Layout.vue`, add a `keydown` listener in the
      existing embedded-only `onMounted` branch that calls `closeDrawer()` on
      Escape; remove it in `onBeforeUnmount` alongside `onHostMessage`.
- [x] 5.2 Verify the standalone docs site is unaffected (the listener attaches
      only when framed).

## 6. End-to-end coverage

- [x] 6.1 Extend the spec (now `e2e/shell/dismissal.spec.ts`): a table-driven
      case per toolbar dialog that opens it, presses Escape, asserts closed;
      reopens, `page.goBack()`, asserts closed **and still in the app**. Plus
      Escape for settings and the docs drawer, LIFO unwinding, a mobile tab, an
      Escape-with-nothing-open baseline, and a menu-on-top-of-a-panel case
      pinning that a dropdown's Escape doesn't fall through.
- [x] 6.2 Add a stacked case (New project → machine picker: one Escape returns to
      New project, a second closes it) and a confirm case (Delete block → Escape
      *and* Back → the block is still present).
- [x] 6.3 Resolve the open question in `design.md`. Answer: the spec stays in
      `e2e/shell/` for now. The folder↔capability guard reads the *baseline*
      specs, and `shell-navigation` is still a change delta, so an
      `e2e/shell-navigation/` folder fails the guard until the change is
      archived. Renamed to `e2e/shell/dismissal.spec.ts` (it now covers Escape as
      well as Back) with a note to move it at archive time.

## 7. Quality gates

- [x] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [x] 7.2 `npm run docs:build` (docs/ changed in task 5).
- [x] 7.3 `npx openspec validate --specs`.
- [x] 7.4 `npm run e2e:chromium -- e2e/shell` — the spec that owns this
      behaviour. 25/25 passing, run twice to confirm. (Earlier runs showed
      wandering failures where the page loaded blank; each failing test passed
      in isolation and the whole folder is green once the Vite dev server is
      warm, so those were cold-start transform flakes, not behaviour.)
- [x] 7.5 `npm run e2e:chromium -- e2e/project-setup e2e/hardware-transfer
      e2e/memory-blocks` (25 passing) and `npm run e2e:chromium --
      e2e/porting-guidance e2e/sharing-player e2e/persistence e2e/memory-map`
      (66 passing) — the capabilities owning the dialogs that gained dismissal.
