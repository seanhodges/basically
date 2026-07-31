## 1. Machine scoping in the docs data types

- [x] 1.1 Add `onlyOn?: string[]` to `ReferenceEntry` and `EscapeEntry` in `docs/reference/data/types.ts`, documenting that absent means every machine on the page and that the existing prose `tag` stays the display label. Named `onlyOn`, not `machines`, to avoid colliding with `ReferenceTableData.machines` (page display names)
- [x] 1.2 Add `tableForMachine(page, dialectId)` and its escape-table counterpart to `docs/.vitepress/theme/dialectCompare.ts` — returning the same table with entries filtered by `onlyOn` — with cases in `dialectCompare.test.ts`. No existing signature in that module changes
- [x] 1.3 Add a `docs/reference/data/machines.ts` listing the 13 machine ids with their page slug, plus the 4 family/union entries, as the single source of what is selectable

## 2. Per-machine keyword crosscheck, then scope the rows to satisfy it

- [x] 2.1 Rewrite `keyword-crosscheck.test.ts` to assert, for each of the 13 registered dialects, that the page rows selected for that machine equal `getDialect(id).keywords` exactly in both directions, replacing the per-page union `PAIRS` table
- [x] 2.2 Run it and record the failures — this enumerates every row needing scoping; expect `bbcmaster` to fail on the missing `EDIT`
- [x] 2.3 Scope the 15 `'BASIC 4.0'` rows in `commodore.ts` to `pet` via `onlyOn`
- [x] 2.4 Scope the 12 `'BASIC 1.1 only'` rows in `cpc.ts` to `cpc6128` via `onlyOn` (12, not the 11 named in `cpc6128/keywords.ts`'s comment — standalone `GRAPHICS` `0xDE` is omitted there)
- [x] 2.5 Scope the 2 `'128K only'` rows in `zxspectrum.ts` to `zxspectrum128` via `onlyOn`
- [x] 2.6 Give the Master its own editor keyword list (`bbcMasterKeywords` = BASIC II + `EDIT`) in `src/dialects/bbcmicro/keywords.ts`, point `bbcmaster.keywords` at it, and add the matching `EDIT` reference row to `bbc.ts` scoped to `bbcmaster`. The Master's tokenizer already accepted `EDIT`; only the editor and docs did not know it
- [x] 2.7 Confirm `zx80.ts`'s 8 tags are left untouched — they are ROM revisions, not machine scoping
- [x] 2.8 Re-run 2.1 until all 13 machines pass

## 3. Per-machine escape codes

- [x] 3.1 Extend `escapes/escape-crosscheck.test.ts` to per-machine assertions, confirming the enumeration below rather than assuming it
- [x] 3.2 Scope the 2 `'48K only'` UDG rows (`0xA3`/`0xA4`) in `escapes/zxspectrum.ts` to `zxspectrum` — on a 128K those bytes are the `SPECTRUM`/`PLAY` tokens
- [x] 3.3 Leave `escapes/commodore.ts` unscoped: all three machines re-export `c64Charset`, so the colour escapes exist on the PET and merely have no visible effect. That is the PET's `colour` fact (task 4.2), not an absent row — scoping it would contradict the charset probe
- [x] 3.4 Re-run 3.1 until it passes

## 4. Porting facts keyed by machine

- [x] 4.1 Change `PortingFacts.id` to a dialect id and add `extends?: string` in `docs/reference/data/types.ts`, with resolution of a base entry at load and a colocated test
- [x] 4.2 Expand `facts.ts` from 8 to 13 entries: family bases plus per-machine overrides for `freeRamBytes`, `screen`, `colour`, `sound`, `programStart`, `screenBase`, and the PET's BASIC 4.0 storage notes
- [x] 4.3 Delete the `REPRESENTATIVE` map from `facts-crosscheck.test.ts` and pin all 13 entries to their own `Dialect`, keeping the existing structural assertions
- [x] 4.4 Verify the VIC-20 reports 3583 and the PET 31743, not the C64's 38911

## 5. Comparison engine and selections

- [x] 5.1 Narrow the tables with `tableForMachine` at the call site in `DialectCompare.vue` before they reach `diffKeywords`, `capabilitySections` and `escapeSections`, and resolve machine → page for `composeGuidance`'s `from`/`to`. Extend `dialectCompare.test.ts` to cover a variant pair on each side; every existing case in it must still pass unmodified
- [x] 5.2 Implement union-selection facts: report a range where members differ, a plain figure where they agree, with tests for both
- [x] 5.3 Build `compare.md`'s options from `machines.ts` — 13 machines plus 4 unions labelled as covering several machines — and group them so the longer list stays scannable
- [x] 5.4 Accept both machine ids and family slugs in `?from=`/`?to=` with no redirect, and confirm `syncUrl` round-trips whichever the user picked
- [x] 5.5 Keep `porting.ts` page-keyed (a spelling is a property of the BASIC, shared by every machine on a page) and teach `porting-crosscheck.test.ts` to cross between page-keyed spellings and machine-keyed facts: substitutions are now checked against that machine's own rows, so advice on `FILL` is redundant on a 6128 but valid on a 464

## 6. IDE handoff

- [x] 6.1 Make `dialectForPage` in `src/components/DocsDrawer.tsx` resolve an exact machine id before falling back to the page lookup, so converting to a variant opens that variant
- [x] 6.2 Name the machine in the convert offer when the target selection covers several machines
- [x] 6.3 Drive-by: correct the BASIC 1.1 keyword count from eleven to twelve in `src/dialects/cpc6128/keywords.ts`'s doc comment and in `docs/contributing/dialect-roadmap.md` — both omit standalone `GRAPHICS` (`0xDE`)

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npm test` — confirm `REPRESENTATIVE` is gone and all 13 per-machine crosschecks pass
- [x] 7.3 `npm run lint` and `npm run format:check`
- [x] 7.4 `npm run docs:build`
- [x] 7.5 `npm run e2e:chromium -- e2e/porting-guidance`, extending `convert-program.spec.ts` to assert converting to a variant lands the IDE in that machine (6128, not 464). Only check this off when the run passes; on failure leave it unchecked with a note on what failed
- [x] 7.6 Pinned every scenario from the manual list as permanent tests in `docs/.vitepress/theme/perMachineCompare.test.ts` (18 cases over the real tables) rather than checking them once by hand: C64 → BBC omits the PET-only disk commands; BBC → CPC 464 omits `FILL`/`MASK` while BBC → CPC 6128 offers them; VIC-20 reports 3583 and PET 31743; CPC 464 → CPC 6128 is 12 gains and 0 losses; a family selection spans free RAM as `3,583–38,911 bytes`. The e2e run covers the page rendering and the `?from=`/`?to=` round trip in a real browser
- [x] 7.7 `npx openspec validate --specs`
