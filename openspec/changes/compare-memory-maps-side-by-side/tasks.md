## 1. Clear the docs/app import boundary

- [ ] 1.1 Move `SCREEN_BASE` from `src/emulator/cpc/memory.ts` to the CPC dialect beside the existing `PROGRAM_BASE` in `src/dialects/cpc464/sysvars.ts`, and import it back into `src/emulator/cpc/memory.ts` from there (the direction `src/emulator/atom/atomMachine.ts` already takes with `src/dialects/atom/addresses`)
- [ ] 1.2 Point `src/dialects/cpc464/memoryMap.ts` and `src/dialects/cpc6128/memoryMap.ts` at the new home, so neither map module reaches `src/emulator/` any more
- [ ] 1.3 Add a cross-dialect test in `src/dialects/memoryMap.test.ts` asserting every registered map declares the same `addressSpace`, so the guide's shared-axis assumption fails as a named assumption if a future machine breaks it
- [ ] 1.4 Extend `DOCS_IMPORTABLE` in `src/components/machinePickerBoundary.test.ts` with the thirteen `dialects/*/memoryMap.ts` modules and the new view modules; confirm the walk still reports the registry and emulator cores as unreachable

## 2. Extract the presentational memory map

- [ ] 2.1 Create `src/components/MemoryMapView.tsx` with the band rendering, write/load markers, address ticks and selection detail lifted from `MemoryMapPanel.tsx`, taking `map`, `zoom`, `notation`, `selectedKey`/`onSelect`, `showDetails`, `scrollTop`/`onScroll`, `sites`, `byIndirection`, `overlay`, `onGeometry` and `onZoomGesture` as props and holding no state of its own
- [ ] 2.2 Declare the `MapWriteSite` shape in `MemoryMapView.tsx` rather than importing `PokeSite`, and add a colocated `MemoryMapView.test.ts` pinning `PokeSite` as structurally assignable to it
- [ ] 2.3 Split the band, marker, tick and detail rules out of `MemoryMapPanel.module.css` into `MemoryMapView.module.css`, leaving the panel chrome behind
- [ ] 2.4 Reduce `MemoryMapPanel.tsx` to the IDE wrapper: store wiring, `pokeSites()` and the write context, zoom/pinch/wheel state and the scroll anchor, the out-of-range warning, the header and controls, and the activity `<canvas>` passed in as `overlay` with `onGeometry` feeding `useMemoryActivity`
- [ ] 2.5 Cover `MemoryMapView` in `MemoryMapView.test.ts`: the same map renders coarse groups below the detail threshold and its own leaf regions above it, reusing the fixtures behind `memoryBands.test.ts`
- [ ] 2.6 Run `npm run e2e:chromium -- e2e/memory-map` and confirm all four specs pass unchanged — the regression gate for the extraction, before any guide work starts

## 3. Carry the program's write sites to the guide

- [ ] 3.1 Add `writeSites` to `ProgramVocabulary` and `ProgramVocabularyReply` in `src/app/programVocabulary.ts`, resolved with `pokeSites()` against the dialect `vocabularyReply()` already selects (the machine being ported *from*, not the selected one)
- [ ] 3.2 Add `'writeSites'` to `PROGRAM_VOCABULARY_FIELDS` in `src/components/DocsDrawer.tsx`
- [ ] 3.3 Extend `src/components/DocsDrawer.test.ts` to pin the new field across the boundary, and to hold the two existing traps: sites are read as the requested dialect, and a program with non-fatal findings still reports them
- [ ] 3.4 Read `writeSites` in `DialectCompare.vue`'s `onVocabularyMessage`, defaulting to `[]` like every other field, so a cached older app answering without it degrades to layouts-only

## 4. The memory-layout section

- [ ] 4.1 Import the thirteen `memoryMap.ts` modules in `docs/reference/compare.md` and attach each to its machine in the `dialects` array, beside `reference`, `escapes` and `facts`
- [ ] 4.2 Create `docs/.vitepress/theme/components/MemoryMapPair.tsx`, the React island rendering one or both `MemoryMapView`s with the pair's shared settings
- [ ] 4.3 Create `docs/.vitepress/theme/components/MemoryMapPair.vue`, owning the shared zoom / detail / notation / scroll state and which pane is active, mirroring how `MachinePicker.vue` owns the state that belongs to the pair of machine fields
- [ ] 4.4 Render `<section id="memory-layout">` in `DialectCompare.vue` immediately after `#language-hardware`, shown only when both machines have a described layout, and add the matching `pageSections` entry
- [ ] 4.5 Mark the open program's write sites on both panes, labelling the source pane as the program's own writes and the target pane as where those addresses land, carrying through the approximate marking the IDE panel already uses
- [ ] 4.6 Add the tabbed layout below the existing `max-width: 640px` breakpoint: tabs named for the two machines, source first and active by default, `role="tablist"`/`tab`/`tabpanel` with arrow-key navigation, and zoom, detail, notation and scroll offset held across the flip

## 5. Retire the superseded address rows

- [ ] 5.1 Delete the `Screen base` and `Program start` entries from `factRows` in `docs/.vitepress/theme/components/DialectCompare.vue`, leaving the memory run ending at `Address notation`
- [ ] 5.2 Update the row-order expectation and its explanatory comment in `e2e/porting-guidance/language-hardware-table.spec.ts`, which currently describes "the two addresses adjacent at the end"
- [ ] 5.3 Confirm `PortingFacts.screenBase`/`programStart` are untouched in `src/reference/facts.ts` and still pinned by `facts-crosscheck.test.ts`, and that `machineDescription.ts` still reports them to the assistant

## 6. Tests and user docs

- [ ] 6.1 Add `e2e/porting-guidance/memory-layout.spec.ts`: both layouts render for a described pair against one shared scale, one zoom control drives both, the notation toggle flips both, and a region reads out when selected
- [ ] 6.2 Cover the absent section in that spec: choosing the machine with no described layout on either side reports no layouts and leaves no empty section behind
- [ ] 6.3 Cover the tabbed fallback in that spec: at a narrow viewport the pair becomes two tabs named for the machines, and flipping preserves zoom and the part of the address space in view
- [ ] 6.4 Cover the program marks in that spec, driving the IDE with a POKE-heavy sample so the write sites cross the boundary and appear on both panes
- [ ] 6.5 Point `docs/reference/memory-management.md` ("The memory map") at the porting guide's side-by-side view, without touching the sidebar in `docs/.vitepress/config.ts`

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 7.5 `npm run docs:build`
- [ ] 7.6 `npm run e2e:chromium -- e2e/memory-map`
- [ ] 7.7 `npm run e2e:chromium -- e2e/porting-guidance`
