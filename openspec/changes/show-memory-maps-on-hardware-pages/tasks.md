## 1. A single-machine memory-map component

- [x] 1.1 Move `writesByIndirection` out of `DialectCompare.vue` into a shared module beside the porting facts, so the pair and the new component ask the same question of `memoryWriteSyntax`
- [x] 1.2 Extract the token block and control-strip rules (`.mm-root` custom properties, `.mm-controls`, `.mm-details`, `.mm-notation`, `.mm-zoom*`, `.mm-placeholder`) out of `MemoryMapPair.vue` into `docs/.vitepress/theme/components/memoryMap.css`, and pull it into the pair with `<style src>`; the pair keeps its pane, tab and hint rules
- [x] 1.3 Create `docs/.vitepress/theme/components/MemoryMapSingle.tsx`: one `MemoryMapView`, no `proportional`, no write sites, no tab plumbing, labelled for assistive technology with the machine's name
- [x] 1.4 Create `docs/.vitepress/theme/components/MemoryMapSingle.vue`: props `machine` and `map`; owns its own zoom level, fit-to-pane measurement (`zoomToFit` + `ResizeObserver`), notation, detail toggle and selection; mounts React behind two dynamic hops as `MemoryMapPair.vue` does; resolves the machine's name from the machine list and its notation and write syntax from the porting facts
- [x] 1.5 Register `MemoryMapSingle` in `docs/.vitepress/theme/index.ts` with `defineAsyncComponent`, so React stays off every page that draws no map

## 2. The layouts on the hardware pages

- [x] 2.1 Add a `<script setup>` importing each page's own machines' `memoryMap` modules to the eight hardware pages that have one, and render `<MemoryMapSingle>` at the top of each per-machine `### Memory` section with a one-line lead-in in the pages' existing voice
- [x] 2.2 Leave the TRS-80's hardware page without a layout, and leave the documentation sidebar untouched

## 3. Pin the wiring

- [x] 3.1 Add `src/reference/hardware-memory-map.test.ts`: walk the machine list, discover which machines have a `memoryMap` module on disk, and assert each one's hardware page imports that map and embeds it for that machine — and that a machine without a module has no layout on its page
- [x] 3.2 Extend `DOCS_IMPORTABLE` in `src/components/machinePickerBoundary.test.ts` with the machine list and the porting facts, so the boundary walk covers the path the new component takes into `src/`
- [x] 3.3 Add one browser test in `e2e/memory-map/` on a page covering several machines: every layout mounts, a region selects and reads out, and zoom, notation and detail act on the layout they belong to and on no other

## 4. Quality gates

- [x] 4.1 `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, `npm run docs:build`
- [x] 4.2 `npm run e2e:chromium -- e2e/memory-map` — the new browser test and the IDE panel's existing regression gate
- [x] 4.3 `npm run e2e:chromium -- e2e/porting-guidance` — the pair component's styles moved, so its memory-layout spec is the regression gate for that
- [x] 4.4 `npx openspec validate --specs`
