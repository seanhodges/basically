## Context

The codebase's house pattern for cross-machine facts is a registry-driven
test with a named-exemption table (`src/dialects/memoryActivity.test.ts` is
the exemplar): every registered dialect owes the feature unless excused by
name with a written reason, and the exemption keys are crosschecked against
the registry. About thirty registration points follow it. About twenty do
not — they are hand-maintained lists that silently skip a machine left out
of them. The PMD 85 rollout demonstrated both halves: the pinned tables were
filled correctly on the first pass, while the unpinned ones produced late
catch-up commits (`c2b6c51`) and gaps that persist today (PMD 85 is absent
from `src/reference/porting.ts`).

One structural constraint shapes the fix: modules imported by the docs
runtime must not drag in the dialect registry —
`src/components/machinePickerBoundary.test.ts` enforces the boundary, and
`src/reference/machines.ts` is hand-authored for exactly this reason. So
"derive from the registry" must mean *crosschecked against* the registry in
test code, not *imported from* it in runtime modules.

## Goals / Non-Goals

**Goals:**

- Every place a new machine must be listed either fails `npm test` when the
  entry is missing or is explicitly, individually excused.
- One source of truth for the reference-page table and the page slug rule.
- Fill the genuine gaps the new pins expose (porting entries for machines
  the pin catches, e2e boot list drift).

**Non-Goals:**

- No change to the Dialect/MachineEmulator seam (`src/dialects/types.ts`)
  — this change is entirely on the test/table side of the seam.
- No reshaping of any table's data model; no merging tables into a
  descriptor.
- No new exemptions and no removal of existing ones; current exemption
  entries move over verbatim with their reasons.

## Decisions

- **A single hand-authored page map, pinned once.** Add
  `src/reference/pages.ts` exporting the page-id → reference-table-data map
  the eight test-local copies each restate today. It stays registry-free
  (hand-authored like `machines.ts`, safe for docs-side imports); one new
  test pins its key set against `dialects.map((d) => referencePageOf(d))`.
  The crosscheck tests (`domain-guidance-crosscheck`,
  `escape-guidance-crosscheck`, `porting-crosscheck`, `abbreviations`,
  `portDescription`, `reference-data`, `escape-data`, `escape-crosscheck`)
  import it instead of declaring their own. Alternative considered:
  deriving each test's map from the registry via the dynamic-import table in
  `src/ai/machineReference.ts` — rejected because those imports are async
  and per-test, and the map exists to be shared with docs-side modules that
  must not see the registry.
- **Slug helper takes the shape, not the registry.**
  `referencePageOf({ id, docsReference? })` lives beside `pages.ts` and
  operates on the two fields, so both registry-side and docs-side callers
  can use it without crossing the import boundary. The six-plus modules and
  tests that recompute `docsReference ?? id` switch to it.
- **Exemption tables, not conditionals, for editor coverage.**
  `src/editor/constructs.test.ts` iterates the registry with a
  `NO_CONSTRUCT_TEMPLATES` map (id → reason) crosschecked against the
  registry — same for `variableLint` coverage and `porting.ts` membership.
  This follows `memoryActivity.test.ts` exactly; a new machine fails loudly
  until it ships the feature or is excused in review.
- **Family claims for the sampled batteries.** `cursorKeys.test.ts` and
  `profileTransparency.test.ts` deliberately test one machine per emulator
  wiring family; keep that, but add a claims table (family → member ids)
  whose union is crosschecked against the registry, so a sixteenth machine
  must join a family or add one.
- **Text pins for non-importable surfaces.** The `.vk-theme-<id>` CSS
  check and the docs sidebar/index check read the file as text, following
  the existing precedents (`graphicsPalette.test.ts` reads
  `e2e/paletteMachines.ts` as text; `fontCoverage.test.ts` reads the
  VitePress CSS). The e2e `MACHINES` list moves to a flat
  `e2e/bootMachines.ts` pinned the same way `paletteMachines.ts` already
  is. Alternative considered: importing `docs/.vitepress/config.ts` into
  vitest — rejected; it pulls VitePress types into the unit-test graph for
  no gain over the established text-pin pattern.

## Risks / Trade-offs

- [More entries to write when adding a machine] → Each new pin fails with a
  message naming the file and the shape of the missing entry, which is
  strictly better than a silent gap; the `adding-a-target-system` skill
  table shrinks correspondingly (tracked in the follow-up docs change).
- [Text pins are brittle to formatting] → Pin on stable tokens
  (`.vk-theme-<id>`, `/reference/<page>`) rather than layout; both
  precedent tests have proven stable.
- [Filling the exposed `porting.ts` gaps adds real content, not just
  tests] → Scope is bounded to the machines the new pin flags; content is
  derived from the dialects' own keyword tables per the existing
  `porting-crosscheck` validation.

## Migration Plan

Land in one change; each bullet in tasks is independently green. The proof
for every new pin is a deliberate failure: remove one machine's entry,
confirm `npm test` fails naming it, restore.
