## Why

Twelve dialects carry a `keyboardLayout.ts` of 216–326 lines with an
identical scaffold: the `Legend` types and the `lbl()` / `act()` / `word()` /
`ins()` / `cursorKey()` / `key()` builders are verbatim in six files and
hand-rolled in different shapes in the other six. The cost showed up when
cursor-key support landed: one feature needed near-identical edits in
twelve files, three of the diffs byte-identical. `src/keyboard/templateRows.ts`
already hoists the geometry; this change hoists the legend plumbing so the
next cross-cutting keyboard feature is a one-file edit.

## What Changes

- New shared module in `src/keyboard/` (beside `templateRows.ts`) exporting
  the `Legend`/`Legends` types and the standard builders (`lbl`, `act`,
  `word`, `ins`, `cursorKey`, and a generic `key(token, legends)` accepting
  a `readonly Legend[]`, since dialects use three to five layers).
- Migrate the twelve non-variant `keyboardLayout.ts` files onto the shared
  builders; each keeps only its machine data — legend text, layers, theme,
  `editorModes`, `graphicsPalette`, `controller.bindings`, and genuinely
  machine-specific key behaviour (e.g. the ZX81's shifted-digit cursor
  emits).
- The dialects that hand-roll differently shaped builders (pet,
  commodore64, trs80, pmd85, altair8800) either adopt the shared builders
  or keep a thin local adapter over them where their layout genuinely needs
  a different shape — decided per machine in the design.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — pure refactor. Every keycap, legend, layer, and emitted token stays
byte-identical; the per-dialect `keyboardLayout.test.ts` files and the
registry-driven `src/keyboard/layoutGeometry.test.ts` pin that.

## Non-goals

- No visual or behavioural change to any keyboard: same keys, same
  legends, same emitted tokens, same themes.
- No changes to `layoutSchema.ts`'s public types beyond re-exports; the
  `VirtualKeyboard` renderer is untouched.
- No forcing of the variant dialects (cpc6128, zxspectrum128, bbcmaster) —
  they already delegate to their parents and stay that way.

## Impact

- New shared module + test in `src/keyboard/`.
- `src/dialects/<name>/keyboardLayout.ts` across the twelve base machines
  (each shrinks; colocated tests unchanged and stay green).
- Guarded by `src/keyboard/layoutGeometry.test.ts`,
  `src/dialects/cursorKeys.test.ts`, per-dialect layout tests, and
  `npm run e2e:chromium -- e2e/virtual-input` for the rendered result.
