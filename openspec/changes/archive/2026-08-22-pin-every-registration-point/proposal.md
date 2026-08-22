## Why

Registering a machine touches two kinds of cross-cutting table: those a
registry-driven test pins (forget one and `npm test` fails), and those
nothing checks (forget one and the suite stays green while the machine
silently misses a feature). The PMD 85 rollout hit the second kind
repeatedly: it is absent from `src/reference/porting.ts` today, the
construct-template test still loops a hardcoded list of nine older dialects,
and five reference crosscheck tests keep their own hand-maintained page maps
that simply skip any machine left out of them. Every future machine pays the
same tax; this change converts the silent gaps into failing tests.

## What Changes

- Derive the test-local page tables in `src/reference/` crosscheck tests
  (`domain-guidance-crosscheck`, `escape-guidance-crosscheck`,
  `porting-crosscheck`, `abbreviations`, `portDescription`,
  `reference-data`, `escape-data`, and the `escape-crosscheck` `EXTRAS`
  map) from one shared, registry-crosschecked page map instead of eight
  independent hardcoded copies.
- Make `src/editor/constructs.test.ts` iterate the registry (dropping its
  hardcoded nine-dialect list) with a named-exemption table in the
  `memoryActivity.test.ts` house style; same treatment for
  `src/editor/variableLint.ts` coverage and `src/reference/porting.ts`
  membership (adding the missing PMD 85 entries where the pin exposes them).
- Add missing crosschecks: `src/dialects/cursorKeys.test.ts` family sampling
  and `src/dialects/profileTransparency.test.ts` `FAMILIES` both gain a
  registry completeness guard so an uncovered new machine fails loudly.
- Pin the untested per-machine wiring: a `.vk-theme-<id>` block exists in
  `src/keyboard/VirtualKeyboard.css` for every layout that declares a theme;
  the docs sidebar (`docs/.vitepress/config.ts`) and `docs/reference/index.md`
  carry every registered dialect's reference page; the e2e
  `emulator-boot.spec.ts` `MACHINES` list is pinned against the registry by
  a unit test rather than only by a browser run.
- Single-source the reference-page slug: one exported helper for
  `docsReference ?? id`, used by the six-plus modules and tests that
  currently recompute it independently.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this is a pure refactor of test coverage and internal tables. No
user-visible behaviour changes and no spec deltas.

## Non-goals

- No new runtime features; where a new pin exposes a genuinely missing
  entry (e.g. PMD 85 in `porting.ts`), filling that entry is in scope, but
  redesigning any table's shape is not.
- No consolidation of the per-machine tables into a single descriptor —
  colocated tables held by crosschecks are the working house pattern.
- No changes to which machines are exempt from a battery; existing
  exemptions are carried over verbatim with their reasons.

## Impact

- `src/reference/*.test.ts` crosscheck tests plus a small shared page map
  module in `src/reference/`.
- `src/editor/constructs.test.ts`, `src/editor/variableLint.ts` (+ test),
  `src/reference/porting.ts`.
- `src/dialects/cursorKeys.test.ts`, `src/dialects/profileTransparency.test.ts`.
- `src/keyboard/` (new theme-presence test), `src/app/` or `src/components/`
  (sidebar/index pin), `e2e/program-execution/emulator-boot.spec.ts` (list
  moves next to a pinnable module).
- No production bundle impact beyond the slug helper; everything else is
  test code.
