# Plan: streamline the e2e suite

Status: **in progress** — Phases 0–3 are done; Phases 4–5 are not yet
implemented. The CLAUDE.md "Writing efficient tests" guidance derived from this
plan _is_ already in place; new and updated tests should follow it now. Existing
tests get refactored by completing the remaining phases.

Phase 3 took the Chromium suite from 207 tests / 37 specs to **173 tests / 36
specs**, with the emulator-booting count down by nine machines and two of the
four 120 s budgets gone.

## Context

The Playwright suite has grown to **199 tests / 37 specs**, run in CI on one
`ubuntu-latest` runner (1 worker, Chromium-only, `retries: 2`,
`timeout-minutes: 30`). A green run takes ~28–34 min — flirting with the job
cap, and any flaky 120s-budget test retried twice blows through it.
Parallelisation isn't available as a lever, so the fix is fewer, denser tests.

The unit suite is already enormous (336 files, ~3,600 cases) and includes
**headless ROM-booting emulator tests for every machine**
(`src/dialects/*/emulator/*Machine.test.ts`, per-dialect `samples.test.ts`,
`src/emulator/*`) plus unit coverage that many e2e tests duplicate (share-verb
bijection in `src/player/routes.test.ts`, autosave rules in
`src/storage/settings.test.ts`, AI merge classification in
`src/ai/codeExtractor.test.ts`, machine-picker grouping, cassette round
trips…). Most e2e cost is redundancy, not coverage.

**Strategy:** e2e proves only what a real browser can prove (canvas paints,
touch, clipboard, `history.back()`, iframes, downloads, `decodeAudioData`);
per-machine matrices become one representative per emulator wiring family plus
a registry-driven vitest; tests sharing expensive setup merge into journey
tests; fixed sleeps become polls.

Target: **199 → ~129 tests, ~58 → ~25 emulator boots, CI wall clock
~30 min → ~11–13 min.**

This is a pure test refactor — no OpenSpec spec deltas. Constraint:
`src/e2eCapabilityLayout.test.ts` requires every `e2e/` folder to match an
`openspec/specs/` capability (or `shell`) and no specs at the root — all
folders stay populated throughout.

## Phase 0 — Baseline ✅

Run `npm run e2e:chromium` once; keep `playwright-report/results.json`
per-file durations as the before-measurement.

`playwright-report/` is gitignored, so the measurement is recorded here
instead. Taken on the commit before Phase 1, on a multi-core dev box (several
workers) — so the wall clock is _not_ comparable to CI's single worker. **The
sum of per-test durations is the figure to compare against**, since that is
what a 1-worker runner pays.

| Baseline (Chromium)               | Value                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| Tests executed                    | 207 (the suite grew past the 199 the plan was written against) |
| Sum of test durations             | **13.3 min**                                                   |
| Wall clock (multi-worker dev box) | 7.0 min                                                        |

Slowest specs, by summed test duration:

| Spec                                         | Baseline |
| -------------------------------------------- | -------- |
| `program-execution/emulator-boot.spec.ts`    | 58.3s    |
| `sharing-player/share-flow.spec.ts`          | 55.4s    |
| `shell-navigation/dismissal.spec.ts`         | 53.7s    |
| `ai-assistant/ai-panel.spec.ts`              | 47.1s    |
| `persistence/boot-storage.spec.ts`           | 46.3s    |
| `porting-guidance/filter-by-program.spec.ts` | 42.7s    |
| `porting-guidance/convert-program.spec.ts`   | 38.5s    |
| `virtual-input/graphics-palette.spec.ts`     | 33.5s    |
| `code-editor/editor-shortcuts.spec.ts`       | 33.5s    |
| `project-setup/new-project.spec.ts`          | 29.2s    |
| `ai-assistant/apply-actions.spec.ts`         | 27.6s    |
| `sharing-player/player.spec.ts`              | 25.2s    |
| `ai-assistant/checked-answers.spec.ts`       | 23.7s    |
| `porting-guidance/memory-layout.spec.ts`     | 20.6s    |
| `ai-assistant/driving.spec.ts`               | 19.6s    |
| `memory-blocks/asm-editor.spec.ts`           | 19.6s    |
| `hardware-transfer/export-transfer.spec.ts`  | 18.3s    |
| `memory-blocks/block-tabs.spec.ts`           | 15.1s    |

The ordering confirms the plan's targets: the four biggest specs are all ones
Phase 3/4 trims.

**Known pre-existing flake** (not introduced by this plan): the first test to
run against a cold Vite dev server can exceed the 5s default `expect` timeout
while Vite transforms the module graph for the first request, failing on
`openApp`'s `.cm-content` visibility check. It passes on a warm server. Worth
fixing separately (warm the server before the run, or raise `expect.timeout`);
Phase 1's drop to `retries: 1` still covers it in CI.

## Phase 1 — Mechanical fixes (zero coverage risk) ✅

- `playwright.config.ts`: `retries: process.env.CI ? 1 : 0` (was 2). Keep all
  4 browser projects (the release matrix) and **both** webServers (the docs
  server backs the remaining porting-guidance + docs-drawer tests and boots in
  parallel with the app server — scoping it isn't worth the config
  complexity).
- Delete the 5 dead unasserted `page.screenshot()` calls:
  `memory-map/memmap-c64.spec.ts:61`, `memory-map/memmap-swap.spec.ts:66`,
  `code-editor/outline.spec.ts:61,111`, `program-execution/debug.spec.ts:86`.
- Add `waitForAutosave(page, marker)` to `e2e/helpers.ts` — `expect.poll` on
  `localStorage.getItem('mbide.autosave.doc')` — and replace the three
  `waitForTimeout(2600)` sleeps in `persistence/boot-storage.spec.ts` (no app
  change; the 2 s autosave interval stays).
- Kill the hand-launched Chromium instances (3 `chromium.launch()` sites, not
  the 4 first counted): `sharing-player/player.spec.ts` landscape describe →
  `test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })`
  (still skipped off-chromium); `shell/landscape-layout.spec.ts` → create
  contexts from the worker's `browser` fixture (two viewports in one test).

## Phase 2 — Unit backfill (before any e2e deletion) ✅

1. **`src/dialects/memoryMapDetail.test.ts`** (new): for
   zx81/zx80/cpc464/cpc6128 assert the detail sub-regions and stable top-level
   bands that `memory-map/zoom-detail.spec.ts` checks per machine (plain
   import of each dialect's memory map).
2. **`src/dialects/debugCapability.test.ts`** (new, registry-driven): assert
   each registered dialect's debugger support (the optional `debugStep` on
   `MachineEmulator` / its dialect-level flag in `src/dialects/types.ts`)
   matches expectation — replaces `debug.spec.ts`'s 4-machine "Step/Continue
   show" loop, for all machines at once. Built as a crosscheck against every
   machine's real `currentLine`/`debugStep` (pattern:
   `src/ai/machineObservability.test.ts`), so the flag cannot drift from the
   emulator; all fourteen machines construct in ~0.7 s.
3. **Extend the `src/app/surfaces` tests**: Import/Export/Outline dialogs
   registered as same-kind dismissible surfaces (backs trimming
   `dismissal.spec.ts`'s `TOOLBAR_DIALOGS` loop 3→1).
4. **Compare-table rows**: extract the fact-row list from
   `docs/.vitepress/theme/components/DialectCompare.vue` into an importable TS
   module; add a crosscheck vitest (pattern:
   `src/reference/porting-crosscheck.test.ts`) pinning the row order and
   values that `porting-guidance/language-hardware-table.spec.ts` asserts.
   Run `npm run docs:build` after touching the `.vue`.
   Landed as `factRows`/`factRowLabels` in `src/reference/compare.ts` +
   `src/reference/compare-facts-crosscheck.test.ts`; the `.vue` imports the
   function under an alias, because `<script setup>` exposes imports to the
   template and the page already had a `factRows` binding there.

## Phase 3 — Matrix trims (the big wins) ✅

- **`program-execution/emulator-boot.spec.ts` 15 → 6**: keep the
  picker↔MACHINES guard and the focus test; cut the 13-machine boot loop to
  **4 representatives, one per emulator wiring family** — `zxspectrum`
  (self-contained Z80 core; stands for zx80/zx81/zxspectrum128/trs80/cpc),
  `pet` (cpu6502 family; stands for vic20/atom), `commodore64` (viciious),
  `bbcmicro` (jsbeeb). Per-machine boot+screen behaviour is already
  headless-proven; the browser only adds per-family worker/canvas wiring.
  `test.setTimeout(90_000)` (was 120 s) with a comment naming each family.
  Saves ~4–5 min.
- **`sharing-player/share-flow.spec.ts` 16 → 4**: 14-verb loop → 2
  representative verbs from different families; the verb↔dialect bijection is
  already unit-proven in `src/player/routes.test.ts`. Keep the `?open=`
  handover and See-the-Code tests.
- **`memory-map/` 9 → 4**: `zoom-detail` 4 machines → 1 (zx81, the in-browser
  slider/zoom UX; the matrix moves to the new vitest); `bbc-memmap` 3 → 1
  (bbcmicro; the jsbeeb live overlay is the unique bit); merge `memmap-c64`
  (drop its Play/live-overlay tail — proven by memmap-swap; assert regions +
  POKE markers statically) and `memmap-swap` into one `memmap.spec.ts`.
- **`virtual-input/graphics-palette.spec.ts` 8 → 5**: ink-on-paper loop 13
  machines → 3 with machine-specific `vk-theme-*` CSS (zxspectrum, bbcmicro,
  commodore64; comment that the base rule covers the rest — keep
  `paletteMachines.ts` and its guard test); merge the two Spectrum tests;
  merge the three C64 tests into one session.
- **`program-execution/debug.spec.ts` 3 → 2**: delete the per-dialect
  Step/Continue loop (replaced by the Phase 2 vitest).
- **Delete `porting-guidance/language-hardware-table.spec.ts`** (3
  static-content tests, replaced by the Phase 2 crosscheck; the folder keeps
  3 other specs).

Measured after Phase 3, Chromium only, one folder at a time on a dev box:

| Folder              | Tests   | Wall clock |
| ------------------- | ------- | ---------- |
| `program-execution` | 18 → 8  | 23 s       |
| `sharing-player`    | 24 → 12 | 29 s       |
| `memory-map`        | 9 → 4   | 15 s       |
| `virtual-input`     | 11 → 8  | 22 s       |
| `porting-guidance`  | 28 → 25 | 1.1 min    |

Two deviations from the plan as written, both to keep a trimmed loop from
quietly becoming an empty one: `emulator-boot`'s picker guard now also fails
when a `REPRESENTATIVES` id stops matching a machine, and `share-flow` resolves
its two verbs through `SHARE_VERBS` and throws at collection time if one is
renamed. The palette's ink-on-paper trim keeps three machines because those are
the three with a `vk-theme-*` block in `VirtualKeyboard.css`; no rule in that
stylesheet scopes `.vk-graphic` to a theme, so the base rule covers the rest.

## Phase 4 — Merge/dedupe passes (one capability per commit)

Merge tests that repeat expensive setup into staged journey tests; drop tests
whose assertion is unit-covered:

- **ai-assistant 29 → 22**: ai-panel: drop the subsumed `/hide` desktop test,
  merge the beforeunload pair; apply-actions: drop "whole listing offers
  replacing" (classification unit-covered in `codeExtractor.test.ts`, the
  replace path still exercised twice); checked-answers: merge the first three
  into one check-journey (two fewer full emulator runs); driving: merge the
  two identical-stub tests; shown-screen: merge tests 2+3 into one three-ask
  journey.
- **porting-guidance 17 → 12**: convert-program: merge happy-path +
  payload-capture; merge the two decline tests into one guide session (saves
  two 5-step setups incl. 15 s iframe waits). filter-by-program: drop the
  Escape-dismissal variant and the 10 s self-dismissal-timer test.
  choose-machine: merge tests 1+2.
- **code-editor 20 → 15**: completion-abbreviation 4 → 2 (merge per input
  method); control-chips 3 → 2; editor-shortcuts 11 → 9 (one "global
  shortcuts open their panels" test; drop the completion-popup half
  duplicated elsewhere).
- **shell-navigation 15 → 10** (`dismissal.spec.ts`): merge the Back/Escape
  settings pair; drop the standalone docs-Escape test (covered by the stacked
  test); `TOOLBAR_DIALOGS` 3 → 1 + vitest; merge the mobile pair; merge the
  favicon-baseline pair.
- **persistence 15 → 13** (`boot-storage.spec.ts`): drop "blocked
  localStorage" (subsumed by the both-blocked test + unit coverage); merge
  the two two-tab tests. Keep custom-rom and files intact.
- **sharing-player `player.spec.ts` 8 → 5**: merge boot+restart+export-dialog
  into one ZX81 player journey; landscape describe → 1 test.
- **project-setup 9 → 6**: drop the manufacturer-grouping and ROM-missing
  tests (unit-covered by the `machinePicker`/`machineAvailability` tests; the
  latter also still browser-asserted in custom-rom); merge the two
  picker-dialog tests.
- **hardware-transfer 6 → 5**: merge cassette playback + robust-mode into one
  saved-doc journey. Keep `cassette-import.spec.ts` untouched (the one real
  `decodeAudioData` round trip; its 120 s budget is justified).
- **shell `responsive.spec.ts` 3 → 2**; **virtual-input `touch-input.spec.ts`
  3 → 2**; **memory-blocks `block-tabs.spec.ts` 5 → 4**.

## Phase 5 — Final verification

Run the full `npm run e2e:chromium` and compare wall clock against the
Phase 0 baseline.

## Verification (every phase)

`npm run typecheck && npm test && npm run lint && npm run format:check`, plus
`npm run e2e:chromium -- e2e/<folder>` for each touched folder. One
capability/phase per commit.

## Expected outcome

|                           | Before               | After                 |
| ------------------------- | -------------------- | --------------------- |
| Executed tests (Chromium) | 199                  | ~129                  |
| Emulator-booting tests    | ~58                  | ~25                   |
| 90–120 s timeout sites    | 12                   | 5                     |
| Fixed sleeps              | 3×2.6 s + misc       | 2 justified (≤400 ms) |
| CI green-run wall clock   | ~28–34 min           | ~11–13 min            |
| Worst case with flakes    | blows the 30-min cap | ~15–16 min            |
