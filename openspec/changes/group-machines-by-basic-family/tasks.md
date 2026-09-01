## 1. Declare the family

- [ ] 1.1 Add optional `basicFamily` to `Dialect` in `src/dialects/types.ts`, documenting that it groups where `basicDialect` identifies, and extend the existing `basicDialect` comment to say the two coexist deliberately rather than one superseding the other
- [ ] 1.2 Add `basicFamilyOf({ basicDialect, basicFamily })` beside `referencePageOf` in `src/dialects/referencePage.ts`, importing nothing and taking a shape, so both sides of the docs/registry import boundary can read it
- [ ] 1.3 Set `basicFamily` in each `src/dialects/<id>/index.ts` that needs one: `Microsoft BASIC` (altair8800), `Integer BASIC` (apple1, apple2), `BBC BASIC` (bbcmicro, bbcmaster), `Commodore BASIC` (pet, vic20, commodore64), `Locomotive BASIC` (cpc464, cpc664, cpc6128), `Sinclair BASIC` (zx81, zxspectrum, zxspectrum128); leave it unset where `basicDialect` is already the family name (apple2plus, atari400, atari800, atom, pmd85, trs80, zx80)
- [ ] 1.4 Extend `src/dialects/registry.test.ts` to assert every registered dialect resolves to a non-empty family, that machines sharing a `docsReference` share a family, and that the existing blurb-names-`basicDialect` rule still holds unchanged

## 2. Mirror it for the docs runtime

- [ ] 2.1 Add `basicFamily` to `MachineChoice` in `src/reference/machines.ts` and set it on every entry, keeping the field comments' "matching `Dialect.<field>`" convention
- [ ] 2.2 Update the `page` values in `src/reference/machines.ts` for the five machines whose slug moves: apple1, apple2 → `integer-basic`; zx81, zxspectrum, zxspectrum128 → `sinclair`
- [ ] 2.3 Extend `src/reference/machines-crosscheck.test.ts` to pin `basicFamily` and the moved page slugs back to the registry, so the two lists cannot drift
- [ ] 2.4 Update `src/reference/facts.ts` and `facts-crosscheck.test.ts` for the family field and moved slugs

## 3. Group the machine list by family

- [ ] 3.1 Add `basicFamily` to `MachineLike` in `src/components/machinePicker.ts` and group the `'basic'` arrangement on `basicFamilyOf(m)` rather than `m.basicDialect`
- [ ] 3.2 Widen the search predicate in `src/components/machinePicker.ts` to match the family name and the version name alike, so typing either finds the machine
- [ ] 3.3 Review the `'basic'` entry in `MACHINE_SORTS` against `openspec/specs/control-labelling/spec.md` and relabel it only if the family grouping makes the current wording wrong
- [ ] 3.4 Update `src/components/machinePicker.test.ts:155` from `basicDialect` to the family, and add cases proving the two BBCs land under one heading while their rows still read the version each runs, and that typing a version name finds its machine
- [ ] 3.5 Confirm `src/components/machinePickerBoundary.test.ts` still passes — the new helper must not have pulled the registry into the docs bundle

## 4. Merge the Integer BASIC pages

- [ ] 4.1 Merge `src/reference/apple1.ts` and `apple2.ts` into `integer-basic.ts`, listing both machines on the table and scoping the Apple II additions with `onlyOn: ['apple2']` and a badge
- [ ] 4.2 Merge `src/reference/escapes/apple1.ts` and `apple2.ts` into `escapes/integer-basic.ts` the same way
- [ ] 4.3 Merge `docs/reference/apple1.md` and `apple2.md` into `docs/reference/integer-basic.md`, and their `hardware.md`, `escapes.md` and `formats.md` sub-pages into `docs/reference/integer-basic/`, keeping each machine's hardware material in its own section

## 5. Merge the Sinclair BASIC pages

- [ ] 5.1 Merge `src/reference/zx81.ts` and `zxspectrum.ts` into `sinclair.ts`: list all three machines, scope Spectrum-only rows with `onlyOn: ['zxspectrum', 'zxspectrum128']`, scope ZX81-only rows to `['zx81']`, and carry the existing 128K-only tags through unchanged
- [ ] 5.2 Note on any row that exists on both but behaves differently what the difference is, rather than presenting one machine's behaviour as the page's
- [ ] 5.3 Merge `src/reference/escapes/zx81.ts` and `escapes/zxspectrum.ts` into `escapes/sinclair.ts` with the same scoping
- [ ] 5.4 Merge `docs/reference/zx81.md` and `zxspectrum.md` into `docs/reference/sinclair.md`, and their sub-pages into `docs/reference/sinclair/`, with a section per machine in `hardware.md` — a ZX81 and a Spectrum 128 share almost no hardware and must not be blended into one table
- [ ] 5.5 Run `npx vitest run src/reference/` and fix every row the crosscheck batteries report as scoped to the wrong machines, before polishing any prose

## 6. Rewire the page registry and the docs shell

- [ ] 6.1 Update the imports and both maps in `src/reference/pages.ts` to the new slugs, and confirm `pages.test.ts` passes — it fails until every registered machine's page exists, which is the guard that steps 4 and 5 are complete
- [ ] 6.2 Retitle the Altair page to "Microsoft BASIC" in `docs/reference/altair8800.md`, naming Altair 8K BASIC as the version it runs in the opening prose
- [ ] 6.3 Rewrite the "BASIC dialects" list in `docs/reference/index.md` to the twelve families, each naming the machines it covers
- [ ] 6.4 Update the `Language reference` section of the sidebar in `docs/.vitepress/config.ts` from fourteen entries to twelve, retitled to family names — the one sidebar edit this change is authorised to make
- [ ] 6.5 Fix cross-links to the moved slugs in `docs/reference/compare.md`, `z80-assembly.md`, `file-formats.md`, `porting-basics.md` and `docs/contributing/`
- [ ] 6.6 Check whether the VitePress config offers a redirect mechanism for the three moved URLs; add redirects if it does, and record the break in the proposal if it does not

## 7. Keep the authoring guidance current

- [ ] 7.1 Add `basicFamily` and the revised twelve-family page list to `.claude/skills/dialect-reference-docs/SKILL.md`, so a new machine joins an existing family rather than minting a thirteenth
- [ ] 7.2 Check `.claude/skills/adding-a-target-system/SKILL.md` and `docs/contributing/adding-a-dialect.md` for the dialect metadata a new target must declare, and add the family there too

## 8. Quality gates

- [ ] 8.1 `npx vitest run src/reference/ src/dialects/ src/components/machinePicker.test.ts src/components/machinePickerBoundary.test.ts`
- [ ] 8.2 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 8.3 `npm run docs:build` — the dead-link check is what catches anything left pointing at a moved slug
- [ ] 8.4 `npm run e2e:chromium -- e2e/project-setup`
- [ ] 8.5 `npm run e2e:chromium -- e2e/dialect-toolchain e2e/porting-guidance`
- [ ] 8.6 `npx openspec validate --specs`
- [ ] 8.7 By hand in `npm run dev` and `npm run docs:dev`: the picker's BASIC arrangement shows twelve headings, the merged Sinclair page does not offer a ZX81 reader a Spectrum-only keyword, and the porting guide still reports 48K vs 128 Sinclair BASIC as a difference between the two Spectrums
