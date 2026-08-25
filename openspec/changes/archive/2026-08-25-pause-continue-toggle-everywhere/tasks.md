## 1. One derivation behind every control

- [x] 1.1 In `src/app/runControl.ts`, add the mapping from the existing
      `RunControlState` to what a surface with its own separate Play shows: a
      Pause face while running, a Continue face while paused, and a refused
      Continue face otherwise. Keep `runControlStateOf` as the only place the
      run's state is derived.
- [x] 1.2 Give the Pause face the same glyph and label the control over the
      editor already uses (`runControlGlyph`, `runControlLabel`), so the two
      surfaces cannot word the same action differently.
- [x] 1.3 Give Continue its own mark - `❚▶`, the left half of the Pause glyph
      followed by the Play triangle - so it no longer wears Play's triangle and
      is no longer told apart from Play by fill colour alone. Both codepoints
      are already in use; no new one enters the app. Rewrite the comment above
      the glyph table, which states as fact that Continue shares the play
      triangle.
- [x] 1.4 Check the mark on the surfaces that render it - 13px in the toolbar
      row, 22px on the control over the editor - and add letter-spacing only if
      the bar and triangle read as two marks rather than one.
- [x] 1.5 Extend `src/app/runControl.test.ts`: the new mapping over every
      `EmulatorStatus` × `pausable` × `programEnded` combination, and the two
      rules that are easy to lose - a machine with no debugger offers no pause,
      and a program that has ended is refused rather than restarted. The
      existing glyph test asserts the opposite of the new mark (it is named for
      Play and Continue sharing a triangle), so it inverts: Continue differs
      from Play, and every mark stays in text presentation rather than picking
      up emoji colour.

## 2. The run controls on the editor-and-machine layout

- [x] 2.1 In `src/components/Toolbar.tsx`, turn the Continue button into the
      two-face control: read `requestPause` and the run's settled timing (the
      same reading `Workspace.tsx` uses for the control over the editor), and
      drive face, action, tooltip and disabled state from task 1's mapping.
      Leave Play, Step and Stop as they are.
- [x] 2.2 Style the live faces in the accent blue with dark ink, alongside
      `button.run` rather than reusing `button.primary` (13px text on the
      accent fails contrast against white). Pin a `min-width` sized to the
      longer face so Stop does not shuffle sideways as the run changes state.
- [x] 2.3 Confirm the whole Step/pause group still disappears on a machine
      that offers no line-level debugging.

## 3. The run actions on the machine's tab

- [x] 3.1 In the overflow menu's Run actions (`mobileTab === 'preview'`), give
      the Continue item the same two faces from task 1's mapping - glyph and
      word only; menu items carry no fill.
- [x] 3.2 Check the action still closes the menu and lands the user on the
      machine's tab before the request is sent.

## 4. The keyboard

- [x] 4.1 In `src/app/useGlobalShortcuts.ts`, let the Continue chord pause a
      running program on a debuggable machine, keeping its existing behaviour
      when the run is paused and its refusal when there is neither.
- [x] 4.2 Rename the chord's label in `src/app/shortcuts.ts` to name both
      halves; keep the `run.continue` id, which is internal and never
      persisted.
- [x] 4.3 Update the chord's row in `docs/guide/keyboard-shortcuts.md` to
      match, keeping the page free of internal references.
- [x] 4.4 Cover the new dispatch in `src/app/useGlobalShortcuts` test coverage:
      pauses while running, continues while paused, refuses on a machine with
      no debugger.

## 5. Comments that the change makes untrue

- [x] 5.1 Rewrite the pause-request comment in
      `src/components/EmulatorPane.tsx`, which explains that the mobile tab is
      left alone because the only sender lives on the editor tab. The
      behaviour stands; the reason no longer does.

## 6. Browser coverage

- [x] 6.1 Extend the existing debug journey in
      `e2e/program-execution/debug.spec.ts` rather than adding a cold boot: on
      the desktop half it already has a machine paused at a breakpoint, so
      assert the toolbar control reads Continue there, continues the run, then
      reads Pause and takes a pause of its own. Address the control by test id,
      not by accessible name - name matching is a substring match and the bar
      also carries Play.
- [x] 6.2 Cover the machine tab's run actions in the same journey's touch half,
      where a booted machine is already to hand.

## 7. Quality gates

- [x] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 7.2 `npm run docs:build` (the shortcuts page changes)
- [x] 7.3 `npm run e2e:chromium -- e2e/program-execution` - check off only on a
      passing run; a failing run leaves this unchecked with a note on what
      failed.
