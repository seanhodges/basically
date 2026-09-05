## Why

The three Commodore machines carry 97 control codes each; the Atom has 4 and the
Altair 6. A port off a Commodore machine therefore hands the reader a list of up
to 97 items — more than any other finding on the page produces — and says the
same thing about every one of them: replace it.

They are not equal work, and the difference is not subtle. Of the Commodore
machines' 97 codes, 52 are the CBM/SHIFT key graphics, which have no equivalent
anywhere outside the Commodore family and have to be redrawn; 16 are colour
codes, which a Spectrum expresses directly as `{INK n}` / `{PAPER n}`; 5 are
cursor movements, which most targets express as a print-at. Sorting a long list
by whether the target can express the class at all turns punctuation-in-strings
from the bulk of the job into the part of it that is mechanical.

The guide already groups these codes by category and already does exactly this
shape of work for keyword capabilities — `domain-guidance.ts` says, per target
and per capability, how well the target covers it and what to do instead. The
control codes have no such table.

## What Changes

- **Each control-code category declares what class of code it is**, from one
  shared vocabulary, so that the Commodore page's `key-graphics`, the Sinclair
  pages' `graphics` and the Atom's `graphics` are recognisably the same class
  while each page keeps its own categories and its own editorial order.
- **A per-target, per-class guidance table**, in the shape `domain-guidance.ts`
  already has: how well the target can express this class of code — fully, partly,
  or not at all — and what to do instead where it cannot.
- **Each group of control codes to replace says what the target can do about the
  class**, instead of presenting every category alike.
- **The guidance table is pinned to the real diff**, as the capability guidance
  is: a cell that no pair can reach is dead and fails the crosscheck, and a class
  some source can lose into a target with no cell to describe it fails too.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement modified — *Control codes are grouped by
  what they do* — so that each group reports whether the target can express that
  class of code, and what to do where it cannot.

## Non-goals

- **Re-ordering the groups.** The source page's own category order is editorial
  and deliberate — the Commodore page leads with colour and cursor and ends with
  the raw-byte escape — and the existing requirement says why. This change adds a
  verdict to each group, it does not sort by it.
- **Matching categories across pages to decide the verdict.** Category ids are
  page-scoped, and matching them would announce "nothing like it on the target"
  for codes the target plainly has. The shared class vocabulary is what makes the
  guidance addressable; the verdict is authored, not inferred.
- **Per-code advice.** The guidance is per class, as the capability guidance is
  per capability: repeating a note against each of 52 key-graphics codes would
  make the page longer without making it clearer.
- **Changing which codes are reported, or how they are narrowed to the open
  program.** Both stay exactly as they are.
- **Restructuring the escape tables themselves.** Rows are untouched; the
  declaration each page already makes about its categories gains one field.

## Impact

Affected code:

- `src/reference/types.ts` — `EscapeTableData.categories` entries gain the class
  they belong to, from a shared vocabulary declared alongside `KeywordDomain`.
- `src/reference/escapes/*.ts` — one field per category declaration across the
  nine pages; no row changes.
- `src/reference/escape-guidance.ts` (new) + `escape-guidance-crosscheck.test.ts`
  (new) — the per-target, per-class table and its completeness check, modelled on
  `domain-guidance.ts` and `domain-guidance-crosscheck.test.ts`.
- `src/reference/compare.ts` + `compare.test.ts` — `escapeSections` carries each
  group's class and the guidance cell for it, taken as an argument the way
  `capabilitySections` takes its guidance, so the module stays pure.
- `docs/.vitepress/theme/components/DialectCompare.vue` — renders the verdict and
  the advice against each group.
- `e2e/porting-guidance/` — one browser assertion.

No dependency changes, no storage or share-format changes, and no change to any
charset or tokenizer.
