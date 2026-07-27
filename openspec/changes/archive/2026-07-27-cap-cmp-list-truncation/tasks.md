This change documents work already implemented and verified on the current
branch (not planned work) — every task below is checked off, with a note on
how each was verified.

## 1. Cap the difference lists

- [x] 1.1 Add a small reactive `useTruncatedList` helper to
      `docs/.vitepress/theme/components/DialectCompare.vue`'s `<script
      setup>`: caps a list to its first 10 entries by default, exposes the
      visible slice, whether more exist, how many, and a way to reveal them
      all; resets whenever the compared pair changes.
- [x] 1.2 Instantiate it for each of the seven `cmp-list` sections (false
      friends, keyword renames, keywords to replace, changed-behaviour
      keywords, newly-available keywords, escape codes to replace,
      newly-available escape codes) and switch each `v-for` to the capped
      view.
- [x] 1.3 Add a "Show N more…" row to each list, shown only while more entries
      exist and the list has not been expanded.
- [x] 1.4 Leave every heading/summary count reading the underlying full
      array's length, unaffected by the cap.

## 2. Verify

- [x] 2.1 Manually verify against a live `npm run docs:dev` server with a
      Playwright-driven script (not a checked-in test — see the proposal's
      Non-goals for why no `*.test.ts` was added): for a dissimilar pair
      (ZX81 → BBC), each affected list showed exactly 10 rows plus a
      correctly-worded "Show N more…" row; expanding one revealed the rest and
      removed the row; heading counts matched the full total throughout;
      swapping to a pair whose lists have fewer than 10 entries (e.g. the
      keyword-rename list for ZX81 → ZX Spectrum) showed no control at all;
      changing the pair re-collapsed previously-expanded lists.
- [x] 2.2 Confirm `docs/.vitepress/theme/dialectCompare.test.ts` (the pure
      diff-logic tests) is unaffected and still passes — this change does not
      touch `dialectCompare.ts`.
- [x] 2.3 No e2e task: `porting-guidance` has no `e2e/` folder (a deliberate
      choice recorded in that capability's original design doc), and this
      change does not revisit it.

## 3. Quality gates

- [x] 3.1 `npm run typecheck` — passes.
- [x] 3.2 `npm test` — passes (includes `dialectCompare.test.ts`, unaffected).
- [x] 3.3 `npm run lint` — passes.
- [x] 3.4 `npm run format:check` — passes.
- [x] 3.5 `npm run docs:build` — passes (this change touches `docs/`).
