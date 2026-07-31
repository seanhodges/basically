## 1. Pin the machine facts the picker needs

- [ ] 1.1 Add `manufacturer`, `year` and `blurb` to `MachineChoice` in
      `docs/reference/data/machines.ts`, and fill all 13 entries from the
      registry's `Dialect` values.
- [ ] 1.2 Extend `docs/reference/data/machines-crosscheck.test.ts` so its
      per-dialect case asserts the three new fields against `Dialect`
      alongside `label` and `page`.
- [ ] 1.3 Run `npx vitest run docs/reference/data/machines-crosscheck.test.ts`
      and confirm it fails for any field left wrong, then passes.

## 2. Restate the portraits for the docs

- [ ] 2.1 Create `docs/reference/data/machineArt.ts`: the shared `'0 0 48 32'`
      viewBox and one entry per id in `MACHINE_ART_IDS` plus `generic`, each
      holding that portrait's inner SVG markup, with a `machineArtId(id)`
      resolver that degrades to `generic` exactly as the IDE's does.
- [ ] 2.2 Copy the 13 portraits across from `src/components/machineArt.tsx`,
      expanding the JSX `.map()` runs (Spectrum rainbow, Spectrum 128 fins) and
      substituting the palette constants for their literal hex values.
- [ ] 2.3 Add `docs/reference/data/machine-art-crosscheck.test.ts`: render each
      portrait from `machineArt.tsx` with `renderToStaticMarkup`, strip the
      outer `<svg>` wrapper, normalise attribute order and whitespace on both
      sides, and assert markup equality per id.
- [ ] 2.4 In the same test, assert the docs art ids and `MACHINE_ART_IDS` match
      exactly in both directions, and that `machineArtId` agrees with the IDE's
      for a registered id, an unregistered one and the empty string.
- [ ] 2.5 Run `npx vitest run docs/reference/data/machine-art-crosscheck.test.ts`
      and confirm the normalisation is tight enough to catch a deliberately
      altered fill, then revert the alteration.

## 3. The picker's logic, as a plain sibling

- [ ] 3.1 Create `docs/.vitepress/theme/machinePicker.ts` with
      `groupMachinesByManufacturer`, `machineSummary` and `machineChoiceLabel`
      over `MachineChoice`, mirroring `src/components/machinePicker.ts`
      (manufacturers alphabetical, machines oldest-first within each).
- [ ] 3.2 Add a `fieldMachineLabel(role, machine)` helper giving
      `Porting from: <name>` / `Porting to: <name>`, with a comment stating why
      the IDE's `targetMachineLabel` wording does not carry over to a page with
      two fields.
- [ ] 3.3 Add `docs/.vitepress/theme/machinePicker.test.ts` covering the
      grouping order, both label helpers, and that the two field roles produce
      distinguishable accessible names.

## 4. The picker components

- [ ] 4.1 Create `docs/.vitepress/theme/components/MachineTrigger.vue`: a
      `type="button"` carrying `data-target-machine`, the portrait via `v-html`,
      the machine name, an optional year, a chevron, and `aria-haspopup="dialog"`
      with the field-role label.
- [ ] 4.2 Create `docs/.vitepress/theme/components/MachinePickerDialog.vue`:
      `role="dialog" aria-modal="true"`, manufacturer `<h3>` headings, one
      `data-machine` button per machine with portrait, name, year, blurb and
      `aria-pressed`, and a Cancel action. Render nothing unless open, so SSG
      emits no dialog markup.
- [ ] 4.3 Give the dialog Escape and outside-`pointerdown` dismissal, copying
      `isOutside`'s composed-path test so the trigger's own click reads as
      inside and does not double-toggle.
- [ ] 4.4 Move focus to the `aria-pressed` row on open, matching the IDE's
      behaviour of starting the keyboard where the eye is.
- [ ] 4.5 Port the picker chrome from `MachinePickerDialog.module.css` and
      `MachineTrigger.module.css` into the components' scoped styles, mapping
      the IDE's custom properties onto the docs theme's equivalents and keeping
      the blurb's two-line clamp.

## 5. Wire the guide up

- [ ] 5.1 In `DialectCompare.vue`, replace the two `<label class="cmp-field">`
      `<select>` blocks with `MachineTrigger`s, and delete the `optionGroups`
      computed.
- [ ] 5.2 Hold one `openField: 'from' | 'to' | null` for the pair, so opening
      one picker closes the other by construction, and call `syncUrl` on choice
      exactly where `@change` called it.
- [ ] 5.3 Delete the `makerOf` map from `docs/reference/compare.md` and pass
      `manufacturer`, `year` and `blurb` through the `dialects` mapping instead
      of `group`.
- [ ] 5.4 Register both components in `docs/.vitepress/theme/index.ts`, or
      import them directly into `DialectCompare.vue` if they are used nowhere
      else.
- [ ] 5.5 Check the swap, copy-link and convert-with-AI controls, the
      `sameSelection` note and every section below still behave unchanged, and
      that `?from=`/`?to=` round-trips a shared link.

## 6. Tests over the new behaviour

- [ ] 6.1 Update `e2e/porting-guidance/convert-program.spec.ts` to select
      through the picker — open the "porting to" trigger by its role label,
      click `[data-machine="cpc6128"]` — removing the
      `locator('select').nth(1)` positional selector.
- [ ] 6.2 Add e2e covering that a machine is distinguishable from its relative
      while choosing: the list row for one of a same-named pair carries more
      than its name, and the collapsed trigger still identifies what is chosen.
- [ ] 6.3 Add e2e covering keyboard operation: the picker opens, every machine
      is reachable and choosable without a pointer, and Escape closes it leaving
      the selection as it was.
- [ ] 6.4 Confirm the two triggers are distinguishable by accessible name, so a
      reader is told which choice is which.

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 7.5 `npm run docs:build` — docs change, and this is what proves the docs
      bundle still does not reach into `src/`.
- [ ] 7.6 `npm run e2e:chromium -- e2e/porting-guidance` — leave unchecked with
      a note on what failed if the run does not pass.
