## Why

For dissimilar dialect pairs (e.g. ZX81 → BBC), several of the comparison
page's difference lists run to dozens of rows — "keywords to replace" alone
can pass 70 entries. Every row rendered unconditionally, so a reader skimming
the page for the handful of differences that matter had to scroll past rows
they had no interest in. The lists now cap at the first 10 rows and offer a
"Show N more…" control to reveal the rest, while the section heading and
summary-line counts keep reporting the full total so nothing looks hidden by
accident.

## What Changes

- The comparison's difference lists (false friends, keyword renames,
  keywords to replace, changed-behaviour keywords, newly-available keywords,
  escape codes to replace, newly-available escape codes) each render at most
  10 rows by default, with a "Show N more…" control that reveals the rest of
  that list.
- Section headings and the top summary line continue to count every entry in
  the underlying list, not just the visible rows.
- Choosing a different dialect pair (including swapping source/target)
  collapses every list back to its default capped state.
- A list with 10 or fewer entries is unaffected: no control is shown.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: adds a requirement that long difference lists render
  progressively (capped by default, with a way to reveal the rest) rather
  than rendering every row unconditionally.

## Impact

- `docs/.vitepress/theme/components/DialectCompare.vue` — the only file
  touched. Purely a rendering change to how the existing diff results are
  displayed.
- `docs/.vitepress/theme/dialectCompare.ts` (the diff logic) and
  `docs/reference/data/porting.ts` (the hand-authored porting data) are
  unchanged — this does not alter what the comparison computes, only how many
  rows appear before the reader interacts with the page.
- No new dependencies, no `src/` changes, no `Dialect`/`MachineEmulator`
  impact.

## Non-goals

- Changing what the comparison computes or reports (renames, false friends,
  missing/newly-available commands, operator exclusion, guidance prose) —
  covered by the existing `porting-guidance` requirements and untouched here.
- A configurable page size, "show all" toggle beyond a single reveal, or
  persisting the expanded state across a pair change — the 10-row cap
  re-collapses on every new pair, by design.
- Automated test coverage of the Vue rendering itself: this repo has no
  `@vue/test-utils` (or other component-mounting) dependency and no existing
  convention for testing `.vue` files directly — only the framework-free
  `dialectCompare.ts` is unit-tested. Adding one is a separate, larger
  decision (new dependency, license check) than this presentational change
  warrants.
- e2e coverage: `porting-guidance` has no `e2e/` folder today (a deliberate
  choice recorded in the design doc for the capability's original change),
  and this change does not revisit that decision.
