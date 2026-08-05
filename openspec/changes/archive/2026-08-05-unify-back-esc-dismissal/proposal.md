## Why

The IDE grew two separate, half-finished ways to dismiss a UI surface, and they
cover almost disjoint sets of surfaces. Browser/hardware Back closes six surfaces
(the mobile tab, settings, the AI panel, the on-screen keyboard, the gamepad and
the docs drawer); Escape closes a different five (the toolbar menus, the editor
tab menu, the docs hint, the machine picker and the new-project form). Between
them, eleven modal dialogs answer to neither.

The cost is worst where it hurts most. On a phone, pressing hardware Back inside
Import, Export, Share link, Emulator files, Outline, Welcome, Memory map or any
of the block dialogs does not close the dialog — it leaves the app, discarding
the unsaved program. On desktop, Escape does nothing in nearly every dialog,
including Settings, which Back *does* close. The Escape shortcut is even
advertised in the shortcuts help as "Release emulator / close panel" while the
"close panel" half was never implemented.

## What Changes

- Escape and Back both dismiss the **topmost open surface**, in last-opened-first-
  closed order, across every dismissible surface in the app — not two partial lists.
- The eleven modal dialogs that currently answer to neither gain both: Import,
  Export/transfer, Share link, Emulator files, Outline, Welcome, Memory map,
  Block settings, Delete block, Switch target, and the variable-detail view.
- Surfaces that had only one of the two gain the other: Settings and the docs
  drawer gain Escape; New project and the machine picker gain Back.
- **Confirmation dialogs dismiss as Cancel.** Escape or Back on Delete block or
  Switch target takes the safe path, leaving the program untouched.
- The docs drawer becomes Escape-dismissible even while focus sits inside its
  embedded documentation frame, where key events never reached the IDE before.
- The gamepad remap picker becomes dismissible rather than only completable.
- An auto-shown on-screen keyboard still does **not** consume a Back press, and
  Back from a fully-closed app still leaves the app. Neither behaviour changes.

## Capabilities

### New Capabilities

- `shell-navigation`: how the application shell dismisses ephemeral UI surfaces —
  the ordering guarantee across stacked surfaces, the equivalence of Escape and
  Back, what a dismissal means for a confirmation, and which surfaces are exempt.
  No existing capability owns this: it is cross-cutting shell behaviour, matching
  the existing `e2e/shell/` home for specs no capability owns.

### Modified Capabilities

None. The individual capabilities that own these dialogs (`hardware-transfer`,
`project-setup`, `sharing-player`, `memory-blocks`, `memory-map`,
`porting-guidance`, `persistence`) guarantee what each dialog *does*; none of
them states how a dialog is dismissed, so none of their requirements change.

## Impact

- **Behaviour**: every dismissible surface in the IDE. No change to what any
  dialog does once open — only to how it closes.
- **Code**: a new surface registry under `src/app/`, consumed by the existing
  history-navigation module and the global shortcut handler. The eleven modal
  components need no changes; they already close through store actions. Two
  surfaces currently held in component state (the variable-detail view and the
  gamepad remap picker) move into the store so they can participate.
- **Docs site**: the embedded documentation frame gains an Escape handler that
  asks the host IDE to close the drawer, over the message channel it already uses
  for its close button. No change to the standalone docs site, where the handler
  does not attach.
- **Dialect seam**: none. This is shell behaviour and touches no dialect or
  emulator code.
- **Dependencies**: none added.
