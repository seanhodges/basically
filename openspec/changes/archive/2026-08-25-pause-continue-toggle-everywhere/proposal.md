## Why

A user watching a program run on the two-column layout cannot pause it. The
pause the IDE already implements is offered by exactly one control - the round
run control over the editor on the touch layout - so a tablet in portrait, a
desktop, and even a phone sitting on the emulator tab can only reach a paused
run by setting a breakpoint first. The keyboard is in the same position: the
Continue chord is refused unless the run is already paused, so there is no key
that takes a pause either.

## What Changes

- The toolbar's Continue button becomes a two-position control: it offers
  Pause while a program is running and Resume while it is paused, in the
  same blue and with the same glyphs the run control over the editor uses.
  Carrying a paused run on is called Resume from here on, everywhere it is
  offered - the button, the menu item, the chord and the tooltips.
- The Continue item in the mobile overflow menu (the Run actions on the
  emulator tab) becomes the same two-position control, so the tab that has no
  run control over the editor gains a pause as well.
- The Continue keyboard chord becomes the same toggle: it pauses a running
  program and continues a paused one, and is named for both.
- Where there is nothing to hold still or carry on - the run is stopped, or
  the program has ended and left the machine at its prompt - the control is
  offered but refused rather than falling back to starting the program: the
  toolbar and the menu keep their own separate Play.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-execution`: the guarantee that the primary run control shows and
  acts on the state of the run currently names only the control over the
  editor. It is generalised to every surface that offers to carry a paused run
  on, and gains the rule that such a surface refuses rather than restarts when
  there is no program to pause or continue.

## Non-goals

- Making the refusals visible. A pause is already refused while the IDE is
  checking an assistant's answer, while the assistant is driving the machine,
  and before the first frame is drawn; those conditions are not published to
  the store, so as today the control offers a pause that quietly does nothing
  in those windows. The run control over the editor behaves the same way, so
  this change ships parity, not a regression.
- Reordering the toolbar's run buttons, or changing what Play, Step and Stop
  do.
- The standalone player, which offers no debugger and no pause.
- Any change to what a pause does to the machine, the profiler, or a debug
  session.

## Impact

- The run-control derivation in `src/app/runControl.ts` gains the mapping the
  toolbar and menu need; it becomes the single source of truth for three
  surfaces rather than one.
- `src/components/Toolbar.tsx` (both the desktop-only run buttons and the
  overflow menu's Run actions) reads the pause request and the run's timing,
  which it does not read today; `src/components/Toolbar.module.css` and
  `src/styles.css` carry the button's blue.
- `src/app/useGlobalShortcuts.ts` and the chord's label in
  `src/app/shortcuts.ts`.
- `docs/guide/keyboard-shortcuts.md`, where the chord is listed by name, and
  `docs/guide/testing-programs.md`, which names the control by glyph and word.
- Colocated tests in `src/app/`, and the program-execution e2e journey that
  already boots a machine and crosses the layout breakpoint.
