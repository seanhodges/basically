## Context

`src/keyboard/templateRows.ts` hoists keyboard *geometry* (grid columns, key
span, row token templates) and `src/keyboard/layoutGeometry.test.ts` pins
every registered layout to it. The *legend plumbing* was never hoisted: the
`Legend` union type and the `lbl()` / `act()` / `word()` / `ins()` /
`cursorKey()` / `key()` builders appear verbatim in six dialect
`keyboardLayout.ts` files, and six more express the same idea with
differently shaped local builders (pet's `letter()`, trs80's `Shift`/
`Cursor` types, and so on). The cursor-keys feature had to restate one
three-part edit twelve times because of this. The three variant dialects
(cpc6128, zxspectrum128, bbcmaster) already delegate to their parents and
are unaffected.

## Goals / Non-Goals

**Goals:**

- One home for the legend types and builders, next to the geometry they
  complete; the next cross-cutting keyboard feature edits one file.
- Every keyboard's rendered output — keycaps, legends, layers, themes,
  emitted tokens, editor actions — byte-identical before and after.

**Non-Goals:**

- No change to the Dialect/MachineEmulator seam: `Dialect.keyboardLayout`'s
  type (`src/keyboard/layoutSchema.ts`) and every layout object it exposes
  are unchanged; this refactors how the objects are *built*, inside the
  dialect folders.
- No redesign of layouts, no new keys, no theme changes.
- No forcing a single builder shape onto a machine whose layout genuinely
  needs its own (see Decisions).

## Decisions

- **New `src/keyboard/legendKit.ts`** exporting the `Legend`/`Legends`
  union, the builders (`lbl`, `act`, `word`, `ins`, `cursorKey`), and a
  generic `key(token, legends: readonly Legend[])`. Generic over an array
  rather than a fixed tuple because layer counts vary (three on the Acorns
  to five on the ZX81). Placed beside `templateRows.ts` rather than in
  `layoutSchema.ts` so the schema module stays a pure type surface.
  Alternative considered: extending `templateRows.ts` — rejected to keep
  geometry and legend concerns separately importable.
- **Verbatim-six first, hand-rolled-six case by case.** The six files whose
  helpers are byte-identical (atom, bbcmicro, cpc464, zx80, zx81,
  zxspectrum) migrate mechanically. For the six with local shapes (pet,
  commodore64, trs80, pmd85, altair8800, and the zx-family variations),
  the rule is: adopt the shared builders where the local shape is an
  incidental re-expression of the same idea; keep a thin local adapter
  *over* the shared kit where the machine genuinely differs (e.g. the
  ZX81's cursor keys emitting `['Shift', digit]`, PET's screen-code
  legends). A local adapter must be built on the kit's types, so
  cross-cutting changes to `Legend` reach it by construction.
- **Migration is proven by existing tests, not new ones.** Each dialect's
  colocated `keyboardLayout.test.ts` plus the registry-driven
  `layoutGeometry.test.ts` and `cursorKeys.test.ts` already pin tokens,
  legends, spans, and cursor emits. The kit gets one colocated test for
  builder semantics; no per-dialect test changes are expected, and a
  migration commit that needs to edit a layout test is a red flag to stop
  and look.

## Risks / Trade-offs

- [Subtle legend differences hidden in the hand-rolled six] → Migrate one
  file per commit; the colocated tests pin key-by-key content, and
  `npm run e2e:chromium -- e2e/virtual-input` checks the rendered result
  once at the end.
- [The kit's `Legend` type must cover the union of all twelve shapes] →
  It already exists as the six-file verbatim version (including `emits`);
  the hand-rolled shapes are strict subsets re-spelt. If one is not, that
  machine keeps its adapter (see Decisions) rather than widening the kit
  speculatively.

## Migration Plan

Kit + its test first; then the verbatim six in one commit; then the
remaining six one commit each. Every commit passes the full quality gate;
rollback is per-commit revert.
