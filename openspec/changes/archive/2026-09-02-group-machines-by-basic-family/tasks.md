## 1. Declare the family

- [x] 1.1 Add optional `basicFamily` to `Dialect` in `src/dialects/types.ts`, documenting that it groups where `basicDialect` identifies, and extend the existing `basicDialect` comment to say the two coexist deliberately rather than one superseding the other
- [x] 1.2 Add `basicFamilyOf({ basicDialect, basicFamily })` beside `referencePageOf` in `src/dialects/referencePage.ts`, importing nothing and taking a shape, so both sides of the docs/registry import boundary can read it
- [x] 1.3 Set `basicFamily` in each `src/dialects/<id>/index.ts` that needs one: `Microsoft BASIC` (altair8800), `Integer BASIC` (apple1, apple2), `BBC BASIC` (bbcmicro, bbcmaster), `Commodore BASIC` (pet, vic20, commodore64), `Locomotive BASIC` (cpc464, cpc664, cpc6128), `Sinclair BASIC` (zx81, zxspectrum, zxspectrum128); leave it unset where `basicDialect` is already the family name (apple2plus, atari400, atari800, atom, pmd85, trs80, zx80)
- [x] 1.4 Extend `src/dialects/registry.test.ts` to assert every registered dialect resolves to a non-empty family, that machines sharing a `docsReference` share a family, and that the existing blurb-names-`basicDialect` rule still holds unchanged

## 2. Mirror it for the docs runtime

- [x] 2.1 Add `basicFamily` to `MachineChoice` in `src/reference/machines.ts` and set it on every entry, keeping the field comments' "matching `Dialect.<field>`" convention
- [x] 2.2 Extend `src/reference/machines-crosscheck.test.ts` to pin `basicFamily` back to the registry, and to hold each reference page to a single family, so the two lists cannot drift
- [x] 2.3 Leave `src/reference/facts.ts` and `facts-crosscheck.test.ts` alone: the comparison names the version each machine runs, which `facts.ts` already restates and the crosscheck already pins, and a family it never prints would be data nothing reads

## 3. Group the machine list by family

- [x] 3.1 Add `basicFamily` to `MachineLike` in `src/components/machinePicker.ts` and group the `'basic'` arrangement on `basicFamilyOf(m)` rather than `m.basicDialect`
- [x] 3.2 Widen the search predicate in `src/components/machinePicker.ts` to match the family name and the version name alike, so typing either finds the machine
- [x] 3.3 Review the `'basic'` entry in `MACHINE_SORTS` against `openspec/specs/control-labelling/spec.md` and relabel it only if the family grouping makes the current wording wrong
- [x] 3.4 Update `src/components/machinePicker.test.ts:155` from `basicDialect` to the family, and add cases proving the two BBCs land under one heading while their rows still read the version each runs, and that typing a version name finds its machine
- [x] 3.5 Confirm `src/components/machinePickerBoundary.test.ts` still passes — the new helper must not have pulled the registry into the docs bundle

## 4. Keep the authoring guidance current

- [x] 4.1 Add `basicFamily` and the twelve-family list to the authoring skills, so a new machine joins an existing family rather than minting a thirteenth
- [x] 4.2 Check `.claude/skills/adding-a-target-system/SKILL.md` and `docs/contributing/adding-a-dialect.md` for the dialect metadata a new target must declare, and add the family there too

## 5. Quality gates

- [x] 5.1 `npx vitest run src/reference/ src/dialects/ src/components/machinePicker.test.ts src/components/machinePickerBoundary.test.ts`
- [x] 5.2 `npm run typecheck && npm run lint && npm run format:check`
- [x] 5.3 `npm run docs:build` — the guide renders the IDE's own picker, so a field the picker reads and the docs list does not supply fails here
- [x] 5.4 `npm run e2e:chromium -- e2e/project-setup`
- [x] 5.5 `npm run e2e:chromium -- e2e/dialect-toolchain e2e/porting-guidance`
- [x] 5.6 `npx openspec validate --specs`
- [x] 5.7 By hand in the running app: the picker's BASIC arrangement shows twelve family headings, each machine's row still reads the version it runs, and typing a version name finds its machine
