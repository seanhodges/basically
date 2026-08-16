## 1. Run-control derivation

- [x] 1.1 Add `src/app/runControl.ts`: `runControlStateOf(status)` returning
      `'play' | 'pause' | 'continue'` as a total record over `EmulatorStatus`
      (type-only import, so the store's module-load side effects stay out of
      unit tests), plus the glyph and label for each state and a
      `canPauseRun({ checking, driving, drawn })` predicate.
- [x] 1.2 Add `src/app/runControl.test.ts`: the state mapping with an
      exhaustiveness assertion over `EmulatorStatus`; the glyph for each state;
      the labels, including a guard that the control's labels stay
      distinguishable from the toolbar's Play and Continue; and `canPauseRun`
      refusing while an assistant check is armed, while the assistant is
      driving the machine, and before the first frame.

## 2. Store

- [x] 2.1 Add `pauseRequest` and `requestPause()` to `src/app/store.ts`,
      alongside `stopRequest` / `requestStop`, following the bump-a-counter
      convention. Continuing reuses the existing `continueRequest` — do not add
      a second counter.
- [x] 2.2 Extend `src/app/store.test.ts`: `requestPause()` bumps `pauseRequest`
      and leaves the rest of the run state alone.

## 3. Run loop

- [x] 3.1 Add the pause effect to `src/components/EmulatorPane.tsx`, between the
      stop and step effects: stop scheduling frames, release held keys, pause
      the run stopwatch with no line, and report the run as paused. It must not
      set the paused line, publish a pause interval, or move the mobile tab.
- [x] 3.2 Guard the pause effect with `canPauseRun` — refuse while an assistant
      run check is armed, while the assistant is driving the machine, and before
      the first frame has been drawn.
- [x] 3.3 Replace the continue effect's debug-session guard with "a machine
      exists and the run is paused", so one continue serves the breakpoint pause
      and the user's pause. Leave the step effect's guard as it is.
- [x] 3.4 Extend `src/app/runTiming.test.ts`: pausing with no line sets the
      `paused` ending and resuming restores `running` without losing elapsed
      time (only line numbers have been passed to it before).

## 4. The run control

- [x] 4.1 Drive the run button over the editor in `src/components/Workspace.tsx`
      from `runControlStateOf(emulatorStatus)`: dispatch run / pause / continue
      for the three states, take glyph, `aria-label` and `title` from
      `runControl.ts`, and carry `data-testid="fab-run"` and
      `data-state={state}`.
- [x] 4.2 Style the paused and running states in
      `src/components/Workspace.module.css` with an attribute selector inside
      the existing mobile media query — the app's blue accent with dark ink,
      mirroring the green state's treatment. The existing keyboard-lift rules
      must keep applying.

## 5. Keyboard

- [x] 5.1 Gate `run.continue` on the run being paused rather than on the machine
      being debuggable in `src/app/useGlobalShortcuts.ts`; leave `run.step` on
      its debuggable gate.
- [x] 5.2 Update the `debugOnly` note for that shortcut in
      `src/app/shortcuts.ts` so the shortcuts help does not claim it needs a
      debugger.

## 6. Docs

- [x] 6.1 Add the pause/continue behaviour of the run control to
      `docs/guide/testing-programs.md` — user-facing wording, no source paths,
      and one name for continuing a run.

## 7. Browser tests

- [x] 7.1 Fix the selector in `e2e/ai-assistant/apply-actions.spec.ts` that
      finds the run button by its bare glyph — it breaks once the button has an
      `aria-label`. Use `page.getByTestId('fab-run')`.
- [x] 7.2 Extend the existing orientation-change test in
      `e2e/program-execution/debug.spec.ts` — which already has a machine paused
      at a breakpoint at a touch viewport, so no new boot is needed: assert the
      control reads `continue` at the breakpoint pause, then click through
      `pause` and back to `continue`, and confirm the run is paused at the
      breakpointed line again. Address the control by test id, never by role
      name — accessible-name matching is a substring match, and the touch
      layout's overflow menu carries its own Play and Continue. Leave the run
      paused so the test's existing flip-back assertions still hold.

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format`)
- [x] 8.5 `npm run docs:build`
- [x] 8.6 `npm run e2e:chromium -- e2e/program-execution e2e/ai-assistant`
