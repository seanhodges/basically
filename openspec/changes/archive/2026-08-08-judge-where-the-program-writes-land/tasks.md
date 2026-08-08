## 1. Classifying a write

- [x] 1.1 `src/reference/compare.ts`: a pure classification of the program's write
      sites against the source and target layouts — same kind at a different
      address, something else, read-only memory, or outside the target's address
      space — carrying the region each side names and the site's own approximate
      flag. Both maps are arguments; the `MemoryMap` import is type-only, with a
      comment saying so and why that keeps the module's purity rule intact.
- [x] 1.2 Same file: group sites sharing a verdict and a target region, so a loop
      of writes into one buffer is one finding with several addresses.
- [x] 1.3 `src/reference/compare.test.ts`: one case per verdict, built from two
      real machines' maps; an approximate site keeps its doubt; a site with no
      target region reports the out-of-space verdict; grouping puts several
      addresses in one finding; no map on either side yields nothing.

## 2. Reporting the verdicts

- [x] 2.1 `docs/.vitepress/theme/components/DialectCompare.vue`: report the
      verdicts with the memory layout section, absent on the same conditions that
      section is, and subject to the existing cap on long lists.
- [x] 2.2 Same file: an approximate verdict reads as an estimate, matching how the
      layouts already mark an approximate address.
- [x] 2.3 `src/ai/portReport.ts` + `portDescription.ts` + `portDescription.test.ts`:
      the verdicts join what the assistant is handed, where the write sites
      already travel.

## 3. Quality gates

- [x] 3.1 `npm run typecheck`
- [x] 3.2 `npm test`
- [x] 3.3 `npm run lint` and `npm run format:check`
- [x] 3.4 `npm run docs:build`
- [x] 3.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend
      `memory-layout.spec.ts`: a program poking a source machine's screen reports
      what those addresses reach on the target. Only check off when the run passes.
