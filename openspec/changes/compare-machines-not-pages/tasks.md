## 1. Machine scoping in the docs data types

- [ ] 1.1 Add `machines?: string[]` to `ReferenceEntry` and `EscapeEntry` in `docs/reference/data/types.ts`, documenting that absent means every machine on the page and that the existing prose `tag` stays the display label
- [ ] 1.2 Add a `machineRowsFor(page, dialectId)` helper (and its escape-table counterpart) in the docs theme that selects a page's rows for one machine, with a colocated `*.test.ts`
- [ ] 1.3 Add a `docs/reference/data/machines.ts` listing the 13 machine ids with their page slug, plus the 4 family/union entries, as the single source of what is selectable

## 2. Per-machine keyword crosscheck, then scope the rows to satisfy it

- [ ] 2.1 Rewrite `keyword-crosscheck.test.ts` to assert, for each of the 13 registered dialects, that the page rows selected for that machine equal `getDialect(id).keywords` exactly in both directions, replacing the per-page union `PAIRS` table
- [ ] 2.2 Run it and record the failures — this enumerates every row needing scoping; expect `bbcmaster` to fail on the missing `EDIT`
- [ ] 2.3 Scope the 15 `'BASIC 4.0'` rows in `commodore.ts` to `pet`
- [ ] 2.4 Scope the 12 `'BASIC 1.1 only'` rows in `cpc.ts` to `cpc6128`
- [ ] 2.5 Scope the 2 `'128K only'` rows in `zxspectrum.ts` to `zxspectrum128`
- [ ] 2.6 Write a genuine `EDIT` reference row in `bbc.ts` (syntax, description, domain) from `basicIVExtraKeywords` in `src/dialects/bbcmicro/keywords.ts`, scoped to `bbcmaster`
- [ ] 2.7 Confirm `zx80.ts`'s 8 tags are left untouched — they are ROM revisions, not machine scoping
- [ ] 2.8 Re-run 2.1 until all 13 machines pass

## 3. Per-machine escape codes

- [ ] 3.1 Extend `escapes/escape-crosscheck.test.ts` to per-machine assertions and run it to enumerate which escape rows need scoping
- [ ] 3.2 Scope the enumerated rows in `escapes/*.ts` (starting with the colour codes in `escapes/commodore.ts`, which do not apply to the monochrome PET)
- [ ] 3.3 Re-run 3.1 until it passes

## 4. Porting facts keyed by machine

- [ ] 4.1 Change `PortingFacts.id` to a dialect id and add `extends?: string` in `docs/reference/data/types.ts`, with resolution of a base entry at load and a colocated test
- [ ] 4.2 Expand `facts.ts` from 8 to 13 entries: family bases plus per-machine overrides for `freeRamBytes`, `screen`, `colour`, `sound`, `programStart`, `screenBase`, and the PET's BASIC 4.0 storage notes
- [ ] 4.3 Delete the `REPRESENTATIVE` map from `facts-crosscheck.test.ts` and pin all 13 entries to their own `Dialect`, keeping the existing structural assertions
- [ ] 4.4 Verify the VIC-20 reports 3583 and the PET 31743, not the C64's 38911

## 5. Comparison engine and selections

- [ ] 5.1 Thread the selected machine through `diffKeywords`, `capabilitySections`, `escapeSections` and `composeGuidance` in `docs/.vitepress/theme/dialectCompare.ts`, filtering rows by machine, and extend `dialectCompare.test.ts` to cover a variant pair on each side
- [ ] 5.2 Implement union-selection facts: report a range where members differ, a plain figure where they agree, with tests for both
- [ ] 5.3 Build `compare.md`'s options from `machines.ts` — 13 machines plus 4 unions labelled as covering several machines — and group them so the longer list stays scannable
- [ ] 5.4 Accept both machine ids and family slugs in `?from=`/`?to=` with no redirect, and confirm `syncUrl` round-trips whichever the user picked
- [ ] 5.5 Add machine-scoping to `porting.ts` entries only where a spelling or false friend is variant-only, and extend `porting-crosscheck.test.ts` so a scoped entry must name a row that exists for that machine

## 6. IDE handoff

- [ ] 6.1 Make `dialectForPage` in `src/components/DocsDrawer.tsx` resolve an exact machine id before falling back to the page lookup, so converting to a variant opens that variant
- [ ] 6.2 Name the machine in the convert offer when the target selection covers several machines

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test` — confirm `REPRESENTATIVE` is gone and all 13 per-machine crosschecks pass
- [ ] 7.3 `npm run lint` and `npm run format:check`
- [ ] 7.4 `npm run docs:build`
- [ ] 7.5 `npm run e2e:chromium -- e2e/porting-guidance`, extending `convert-program.spec.ts` to assert converting to a variant lands the IDE in that machine (6128, not 464). Only check this off when the run passes; on failure leave it unchecked with a note on what failed
- [ ] 7.6 Manual pass on `npm run docs:dev` → `/reference/compare`: C64 → BBC no longer mentions `DLOAD`/`DIRECTORY`/`SCRATCH`/`HEADER`; BBC → CPC 464 does not offer `FILL`/`MASK` but BBC → CPC 6128 does; → VIC-20 reports 3583; CPC 464 → CPC 6128 reports the 11 BASIC 1.1 additions and no losses; a union target reports free RAM as a spread; `?from=cpc&to=bbc` still reopens the union comparison
- [ ] 7.7 `npx openspec validate --specs`
