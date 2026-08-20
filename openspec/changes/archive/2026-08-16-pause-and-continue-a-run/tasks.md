## 1. Run-control derivation

- [x] 1.1 Add `src/app/runControl.ts`: `runControlStateOf(status, pausable)`
      returning `'play' | 'pause' | 'continue'` from a total record over
      `EmulatorStatus` (type-only import, so the store's module-load side
      effects stay out of unit tests), plus the glyph and label for each state
      and a `canPauseRun({ debuggable, checking, driving, drawn })` predicate.
- [x] 1.2 Add `src/app/runControl.test.ts`: the state mapping with an
      exhaustiveness assertion over `EmulatorStatus`, including a machine that
      cannot be paused keeping the plain Play and a paused run still being
      offered Continue; the glyph for each state; the labels, including a guard
      that the control's labels stay distinguishable from the toolbar's Play
      and Continue; and `canPauseRun` refusing on a machine with no debugger,
      while an assistant check is armed, while the assistant is driving the
      machine, and before the first frame.

- [x] 1.3 Take the end of the program into the derivation: `runControlStateOf`
      reads `{ pausable, programEnded }` and returns Play whenever the program
      has ended, ahead of the status mapping, and `runTiming.ts` exports the
      `timingSettled(timing)` predicate that reads a published timing the way
      `RunStopwatch.settled` reads a live one. Cover both in their colocated
      tests: a running machine whose program has ended offers Play, a pause
      taken after the end offers Play rather than Continue, an unmeasured run
      is not an ending, and the exhaustiveness sweep runs over both flags.

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
- [x] 3.2 Guard the pause effect with `canPauseRun` — refuse on a machine that
      is not `debuggable`, while an assistant run check is armed, while the
      assistant is driving the machine, and before the first frame has been
      drawn.
- [x] 3.3 Replace the continue effect's debug-session guard with "a machine
      exists and the run is paused", so one continue serves the breakpoint pause
      and the user's pause. Leave the step effect's guard as it is.
- [x] 3.4 Extend `src/app/runTiming.test.ts`: pausing with no line sets the
      `paused` ending and resuming restores `running` without losing elapsed
      time (only line numbers have been passed to it before).

## 4. The run control

- [x] 4.1 Drive the run button over the editor in `src/components/Workspace.tsx`
      from `runControlStateOf(emulatorStatus, !!dialect.debuggable)`: dispatch
      run / pause / continue
      for the three states, take glyph, `aria-label` and `title` from
      `runControl.ts`, and carry `data-testid="fab-run"` and
      `data-state={state}`.
- [x] 4.2 Style the paused and running states in
      `src/components/Workspace.module.css` with an attribute selector inside
      the existing mobile media query — the app's blue accent with dark ink,
      mirroring the green state's treatment. The existing keyboard-lift rules
      must keep applying.

- [x] 4.3 Subscribe `src/components/Workspace.tsx` to the run timing the loop
      publishes and pass `programEnded` into the derivation — the whole timing,
      not the buffer-filtered one the profile dialog shows, since this drives
      the machine rather than describing what is on screen.

## 5. Keyboard

- [x] 5.1 No change: `run.continue` keeps its `debuggable` gate. Pausing is
      offered only on debuggable machines, so every run that can be paused
      already has both the toolbar's Continue and F8 to release it.

## 6. Docs

- [x] 6.1 Add the pause/continue behaviour of the run control to
      `docs/guide/testing-programs.md` — user-facing wording, no source paths,
      one name for continuing a run, and what the control does on a machine
      with no step debugger.

- [x] 6.2 Say in `docs/guide/testing-programs.md` what the control does once the
      program ends by itself, that the emulator stays on at its prompt, and that
      the machines which cannot see a program finish go on offering the pause.

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

- [x] 7.3 Extend the finishing-run journey in
      `e2e/profiling/heat-and-memory.spec.ts` — the only place in the suite with
      a machine watched all the way to a finish, so proving it in
      `e2e/program-execution/` would mean booting a second Commodore to reach a
      state this test already sits in: flip to a touch viewport once the run has
      settled and assert the control reads `play` while the status bar still
      reads running. Address it by test id, as above.

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format`)
- [x] 8.5 `npm run docs:build`
- [x] 8.6 `npm run e2e:chromium -- e2e/program-execution e2e/ai-assistant
      e2e/profiling`
