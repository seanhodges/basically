## 1. Make the picker shareable

- [ ] 1.1 Declare `MachineLike { id, name, year, manufacturer, blurb }` in
      `src/components/machinePicker.ts` and retype
      `groupMachinesByManufacturer`, `machineSummary`, `targetMachineLabel` and
      `machineChoiceLabel` off it, removing the `../dialects/types` import.
- [ ] 1.2 Retype `MachineTrigger.tsx` from `dialect: Dialect` to
      `MachineLike`, removing its `../dialects/types` import.
- [ ] 1.3 Give `MachinePickerDialog.tsx` a `machines: readonly MachineLike[]`
      prop, group inside the component memoised on it, and delete the
      module-scope `groupMachinesByManufacturer(dialects)` and the
      `../dialects/registry` import.
- [ ] 1.4 Pass `machines={dialects}` from `NewProjectDialog.tsx` and
      `TargetMachineDialog.tsx`. `Toolbar.tsx` needs no change — confirm it
      only uses `MachineTrigger`.
- [ ] 1.5 Retarget `src/components/machinePicker.test.ts` to `MachineLike`,
      keeping all 9 existing cases; the registry-driven cases still pass
      `dialects` as `MachineLike[]`.
- [ ] 1.6 Confirm no behaviour changed: the IDE picker's grouping, focus-on-open,
      dismissal, labels and markup are identical.

## 2. Guard the boundary

- [ ] 2.1 Add a test that resolves the transitive import graph of each
      docs-importable leaf (`machinePicker.ts`, `machineArt.tsx`,
      `machineArtIds.ts`, `useDismiss.ts`, `MachineTrigger.tsx`,
      `MachinePickerDialog.tsx`) and asserts nothing resolves to
      `src/dialects/registry.ts` or anything under `src/emulator/`.
- [ ] 2.2 Verify it fails: add a registry import to `machinePicker.ts`
      temporarily, confirm the failure names the offending module, revert.

## 3. Pin the machine facts the picker needs

- [ ] 3.1 In `docs/reference/data/machines.ts`, rename `label` → `name` and add
      `manufacturer`, `year` and `blurb`, filling all 13 entries from the
      registry's `Dialect` values, so `MachineChoice` satisfies `MachineLike`.
- [ ] 3.2 Update `docs/reference/data/machines-crosscheck.test.ts` for the
      rename and extend its per-dialect case to the three new fields.
- [ ] 3.3 Run `npx vitest run docs/reference/data/machines-crosscheck.test.ts`
      and confirm it fails for any field left wrong, then passes.

## 4. Mount the picker in the docs

- [ ] 4.1 Add a `vite:` section to `docs/.vitepress/config.ts` (it has none)
      carrying `@vitejs/plugin-react`, already a devDependency.
- [ ] 4.2 Create `docs/.vitepress/theme/components/MachinePicker.vue`: create a
      React root in `onMounted`, unmount in `onUnmounted`, render both triggers
      and the dialog, and hold one `openField: 'from' | 'to' | null` so opening
      one picker closes the other.
- [ ] 4.3 Register it with `defineAsyncComponent` in
      `docs/.vitepress/theme/index.ts`, and `import()` react-dom inside the
      wrapper rather than importing it statically — the two-hop pattern
      `Mermaid.vue` uses, for the modulepreload reason in `config.ts:27-38`.
- [ ] 4.4 Wrap in `<ClientOnly>` with a placeholder sized to the trigger, so the
      picker's absence from pre-rendered HTML costs a paint and not a layout
      shift.
- [ ] 4.5 Add the six-token shim on the picker's root — `--bg-panel`,
      `--bg-raised`, `--border`, `--text`, `--text-dim`, `--accent` — taking
      values from `src/styles.css`.

## 5. Wire the guide up

- [ ] 5.1 In `DialectCompare.vue`, replace the two `<label class="cmp-field">`
      `<select>` blocks with `MachinePicker`, and delete the `optionGroups`
      computed.
- [ ] 5.2 Call `syncUrl` on choice exactly where `@change` called it, so
      `?from=`/`?to=` keep their values and existing shared links still resolve.
- [ ] 5.3 Delete the `makerOf` map from `docs/reference/compare.md` and pass
      `manufacturer`, `year` and `blurb` through the `dialects` mapping instead
      of `group`.
- [ ] 5.4 Check the swap, copy-link and convert-with-AI controls, the
      `sameSelection` note and every section below still behave unchanged.
- [ ] 5.5 Settle the two open questions from the design: whether the trigger
      shows the year, and how the trigger's accessible name distinguishes the
      two fields (role parameter on the shared helper, or an override at the
      call site).

## 6. Tests over the new behaviour

- [ ] 6.1 Update `e2e/porting-guidance/convert-program.spec.ts` to select
      through the picker, removing the `locator('select').nth(1)` positional
      selector — the IDE's `data-target-machine` / `data-machine` hooks now work
      in the guide unchanged.
- [ ] 6.2 Add e2e covering that a machine is distinguishable from its relative
      while choosing: the row for one of a same-named pair carries more than its
      name, and the collapsed trigger still identifies what is chosen.
- [ ] 6.3 Add e2e covering keyboard operation: the picker opens, every machine
      is reachable and choosable without a pointer, and Escape closes it leaving
      the selection as it was.
- [ ] 6.4 Confirm the two triggers are distinguishable by accessible name, so a
      reader is told which choice is which.

## 7. Typecheck the docs

- [ ] 7.1 Add a docs project to `tsc -b` covering `docs/**/*.ts` and the theme's
      `.vue` scripts, so a docs-side misuse of `MachineLike` fails at build
      rather than silently at runtime.
- [ ] 7.2 Fix whatever the first run surfaces in existing docs TypeScript, which
      has never been checked.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck`
- [ ] 8.2 `npm test`
- [ ] 8.3 `npm run lint`
- [ ] 8.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 8.5 `npm run docs:build`, then inspect the emitted chunks: react-dom in
      exactly one lazily-loaded chunk, no emulator core anywhere, and no React
      `modulepreload` on pages other than the porting guide.
- [ ] 8.6 `npm run e2e:chromium -- e2e/porting-guidance` — leave unchecked with
      a note on what failed if the run does not pass.
- [ ] 8.7 `npm run e2e:chromium -- e2e/project-setup` — the IDE's own picker
      after the prop refactor. Leave unchecked with a note if it fails.
- [ ] 8.8 Compare the IDE's picker before and after by eye, and the two surfaces
      side by side. Nothing in the suite sees pixels, so this is the only check
      that catches a portrait rendering wrong.
