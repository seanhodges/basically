## 1. Shared picker logic

- [x] 1.1 Move `MachineGroup` and `groupMachinesByManufacturer` out of `src/components/newProjectOptions.ts` into a new `src/components/machinePicker.ts` — the grouping is no longer new-project specific
- [x] 1.2 Add `machineSummary`, `targetMachineLabel` and `machineChoiceLabel` to `src/components/machinePicker.ts` for the collapsed control and the list rows
- [x] 1.3 Move the grouping cases from `newProjectOptions.test.ts` into a colocated `machinePicker.test.ts` and cover the new label helpers, including that rows whose names prefix one another get distinct labels

## 2. Machine artwork

- [x] 2.1 Add `src/components/machineArtIds.ts` listing which dialect ids have a portrait, plus the id→art resolution with a `generic` fallback for an unregistered or not-yet-drawn machine
- [x] 2.2 Add `src/components/machineArt.tsx` with one flat-colour inline SVG per registered machine on a shared viewBox, typed against the id list so the two cannot drift, reusing the virtual keyboard's per-machine palettes where they exist and recording which colours are new
- [x] 2.3 Add `src/components/machineArt.test.ts` asserting every registered dialect has a portrait, no portrait outlives its dialect, and the fallback is total

## 3. The picker and its trigger

- [x] 3.1 Add `src/components/MachineTrigger.tsx` (+ CSS module): a forwarded-ref `type="button"` control rendering the portrait and name, carrying `data-target-machine` and an accessible name that names the machine even when the label is hidden
- [x] 3.2 Add `src/components/MachinePickerDialog.tsx` (+ CSS module): a controlled, store-free modal listing machines grouped by manufacturer with portrait, name, year and description per row, dismissable by Escape and outside press, focusing the current machine on open
- [x] 3.3 Stack the picker above the standard modal layer so it can open over another dialog

## 4. New-project dialog

- [x] 4.1 Replace the inline machine grid in `src/components/NewProjectDialog.tsx` with the collapsed trigger, keeping the selected machine's description beneath it
- [x] 4.2 Render the picker inside the dialog's form and suspend the form's own dismissal while it is open, so Escape and outside presses close only the picker
- [x] 4.3 Return focus to the trigger when the picker closes, and reset the picker closed each time the dialog opens
- [x] 4.4 Drop the moved grid styles from `NewProjectDialog.module.css`

## 5. Toolbar target control

- [x] 5.1 Add `machinePickerOpen` and its setter to `src/app/store.ts`
- [x] 5.2 Add `src/components/TargetMachineDialog.tsx` binding the picker to the store, closing before calling `setDialect` so the target-switch confirmation never lands underneath, and mount it in `src/App.tsx` with the other dialogs (the toolbar is a stacking context)
- [x] 5.3 Replace both `<select>` render sites in `src/components/Toolbar.tsx` — the inline one and the landscape overflow copy — with the shared trigger, closing the overflow menu when the picker opens
- [x] 5.4 Remap the toolbar's responsive tiers in `Toolbar.module.css`: drop the machine name at the narrow tier leaving the portrait, and move the whole control into the overflow menu on the landscape rail

## 6. End-to-end coverage

- [x] 6.1 Add `chooseMachine` / `chooseTargetMachine` / `targetMachine` helpers to `e2e/fixtures.ts` and name-qualify the New-project dialog lookup, since two dialogs can now be on screen
- [x] 6.2 Migrate every spec that drove or read the old target dropdown to the picker and to `data-target-machine`, and switch `selectDialect` to take a dialect id rather than a name
- [x] 6.3 Rewrite the machine-list guard test to enumerate the picker's rows
- [x] 6.4 Add coverage for the collapsed state, for the year and description appearing on every row, and for the picker closing without taking the New-project dialog with it

## 7. Docs

- [x] 7.1 Update the target-selector references in `docs/contributing/architecture.md` and `docs/contributing/cross-browser-test-plan.md`

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check`
- [x] 8.5 `npm run e2e` (app-visible change)
- [x] 8.6 `npx openspec validate --specs`
