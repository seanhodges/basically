## 1. Shared page map and slug helper

- [ ] 1.1 Add `src/reference/pages.ts`: hand-authored page-id → reference
      table data map (registry-free), plus `referencePageOf({ id, docsReference? })`,
      with a colocated test pinning the map's key set against the registry
      (registry imported in the test only)
- [ ] 1.2 Switch the modules and tests that recompute `docsReference ?? id`
      (`src/reference/machines.ts` consumers, `src/ai/machineReference.ts`,
      `src/app/docsTopic.ts`, `keyword-crosscheck.test.ts`,
      `escape-crosscheck.test.ts`, `machineDescription.ts`) to
      `referencePageOf`
- [ ] 1.3 Replace the eight test-local page tables
      (`domain-guidance-crosscheck`, `escape-guidance-crosscheck`,
      `porting-crosscheck`, `abbreviations`, `portDescription`,
      `reference-data`, `escape-data` `SETS`, `escape-crosscheck` `EXTRAS`)
      with imports of the shared map; confirm each suite still runs the same
      machine set by deliberate-failure check (drop one entry, expect a
      named failure, restore)

## 2. Editor and porting coverage

- [ ] 2.1 Rework `src/editor/constructs.test.ts` to iterate the registry
      with a crosschecked `NO_CONSTRUCT_TEMPLATES` exemption map; fill any
      genuinely missing `constructsByDialect` entries the pin exposes
- [ ] 2.2 Add registry-driven coverage for `src/editor/variableLint.ts`
      wrappers with a crosschecked exemption map
- [ ] 2.3 Pin `src/reference/porting.ts` membership (every reference page
      appears in `keywordEquivalences`/`falseFriends` spellings where its
      dialect has the keyword, or is excused by name); add the missing
      PMD 85 entries the pin flags

## 3. Sampled-battery claims

- [ ] 3.1 Add a family-claims table to `src/dialects/cursorKeys.test.ts`
      whose union is crosschecked against the registry (excused machines
      named with reasons)
- [ ] 3.2 Add a registry crosscheck for `FAMILIES` in
      `src/dialects/profileTransparency.test.ts` (every dialect claimed by
      exactly one family or excused)

## 4. Text-pinned surfaces

- [ ] 4.1 Add a test that every layout declaring `theme: '<id>'` has a
      `.vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`
      (text pin, `graphicsPalette.test.ts` style)
- [ ] 4.2 Add a test that `docs/.vitepress/config.ts` sidebar and
      `docs/reference/index.md` list every registered dialect's reference
      page (text pin; no sidebar content changes beyond what the pin
      exposes as missing)
- [ ] 4.3 Move the `MACHINES` list from
      `e2e/program-execution/emulator-boot.spec.ts` into a flat
      `e2e/bootMachines.ts` and pin it against the registry from a unit
      test (`paletteMachines.ts` pattern); labels pinned to `Dialect.name`

## 5. Quality gates

- [ ] 5.1 Deliberate-failure pass: for each new pin, remove one machine's
      entry and confirm `npm test` fails naming it, then restore
- [ ] 5.2 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 5.3 `npm run e2e:chromium -- e2e/program-execution` (the boot spec
      moved its data module) and `npm run e2e:chromium -- e2e/virtual-input`
      (keyboard theme pin touches nothing rendered, run as belt-and-braces)
