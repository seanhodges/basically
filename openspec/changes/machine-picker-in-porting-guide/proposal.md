## Why

`compare-machines-not-pages` grew the porting guide's selection from 8 docs
pages to 13 machines, and left them in the native `<select>` controls the page
already had. That was the right split of work — the fix was about *what* the
guide compares, not how it is chosen — but it leaves the selection harder to
read than before, and it is the one part of the guide that names a machine by
nothing but a word.

Seven of the thirteen machines are one of a pair whose names prefix or echo one
another: **Spectrum** / **Spectrum 128**, **BBC Micro** / **BBC Master**,
**CPC 464** / **CPC 6128**, and the three Commodores. Those pairs are exactly
the ones the previous change made distinguishable in the *output* — different
free RAM, different commands, a different machine to convert into — so a reader
who picks the wrong one gets a confidently wrong answer with nothing on screen
to suggest they mis-clicked. The archived change's own risk list flagged this:
"Selection count rises from 8 to 13 in a native `<select>` … the follow-up
picker change removes this concern entirely, which is part of why it follows
closely."

The IDE already solved this. Choosing a machine there means an illustrated,
manufacturer-grouped picker where every row carries a portrait, a year and a
one-line blurb. The guide is embedded in the IDE's own docs drawer, so today the
two sit a panel apart, disagreeing about how a machine is named.

## What Changes

- The porting guide's two `<select>` controls become illustrated machine
  triggers, each opening a grouped picker — the same shape, wording and
  grouping as the IDE's. The swap, copy-link and convert-with-AI controls, and
  every section below them, are unchanged.
- Each machine is chosen by more than its name: its portrait, manufacturer and
  year are on the row, and the collapsed trigger keeps the portrait and name in
  view. Relatives stop being one word apart.
- `machines.ts` grows the fields the picker needs — `manufacturer`, `year`,
  `blurb` — restating what `Dialect` already declares, pinned per machine by
  `machines-crosscheck.test.ts` exactly as `label` and `page` already are.
- The 13 portraits are restated for the docs as framework-neutral SVG, and
  pinned to the React originals by a crosscheck that renders
  `src/components/machineArt.tsx` to static markup and compares. A redrawn
  portrait, a new machine, or a portrait removed from the IDE fails until the
  docs copy agrees.
- The manufacturer grouping moves out of `compare.md`. The `makerOf` map
  currently inlined in that page's `<script setup>` — restating the registry
  with no test pinning it — is deleted in favour of the pinned `manufacturer`
  field, and the grouping and label helpers become a plain, unit-tested
  `machinePicker.ts` sibling in the docs theme, matching how the IDE keeps that
  logic out of its components.
- **BREAKING (internal test contract):** `e2e/porting-guidance/convert-program.spec.ts`
  drives the target with `frame.locator('select').nth(1).selectOption('cpc6128')`.
  There is no `<select>` afterwards; it selects through the picker instead. The
  IDE's own e2e already reads machines back through `data-target-machine` and
  `data-machine`, and the guide adopts the same hooks, so the two suites stop
  describing the same act two different ways.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one added requirement — that choosing a machine
  distinguishes it from its relatives by more than its name, so a reader
  selecting between two machines that share a BASIC can see which is which
  before the comparison is drawn. The existing requirement that machines are
  the only thing offered, and that each is named by one string meaning only that
  machine, is unaffected and not restated.

## Non-goals

- **Changing what the comparison reports.** Every section below the controls —
  the summary, capability groups, control codes, guidance, colour key — is
  untouched. This change ends at the two fields.
- **Sharing components between the IDE and the docs.** The docs stay Vue and
  keep their own components; the IDE stays React and is not edited. What is
  shared is the *look and the wording*, held together by crosscheck tests rather
  than by a common runtime. Extracting a real shared component library would
  mean a framework-neutral UI layer this project has no other use for.
- **Relaxing the docs → `src/` import boundary.** The docs runtime still never
  imports `src/`. The portraits are restated and pinned, the same contract
  `machines.ts`, `facts.ts` and every reference table already run under. Only
  `*.test.ts` files under `docs/` import `src/`.
- **Redrawing or adding artwork.** The 13 portraits are copied as drawn. The
  `generic` stand-in comes along for the same reason it exists in the IDE — a
  machine can be registered before its portrait — but no new art is authored.
- **The IDE's own picker.** `MachineTrigger`, `MachinePickerDialog`,
  `machinePicker.ts` and `machineArt.tsx` keep their current behaviour and are
  read, not rewritten. If the crosscheck forces a change it will be in the docs
  copy.
- **The reference pages' machine switcher.** `docs/reference/<family>.md` pages
  and their tables keep whatever controls they have; only the porting
  comparison's two fields change.

## Impact

- **Docs data** (`docs/reference/data/`): `machines.ts` gains `manufacturer`,
  `year` and `blurb` per machine; a new `machineArt.ts` carries the 13
  portraits plus the stand-in as neutral SVG markup;
  `machines-crosscheck.test.ts` extends to the new fields and a new
  `machine-art-crosscheck.test.ts` pins the portraits to `machineArt.tsx`.
- **Docs theme** (`docs/.vitepress/theme/`): new `machinePicker.ts` (grouping
  and label helpers, unit-tested) and `components/MachineTrigger.vue` +
  `components/MachinePickerDialog.vue`, registered in `index.ts`;
  `DialectCompare.vue` swaps its two `<label class="cmp-field">` blocks for
  triggers and drops `optionGroups`; `custom.css` or the components' scoped
  styles carry the picker chrome.
- **Docs page** (`docs/reference/compare.md`): the inlined `makerOf` map is
  deleted and the `dialects` mapping passes the new fields through.
- **Tests**: `e2e/porting-guidance/convert-program.spec.ts` selects through the
  picker; new e2e covering that a machine can be told from its relative in the
  list; unit tests for the docs `machinePicker.ts` mirroring
  `src/components/machinePicker.test.ts`.
- **Not touched**: `src/` entirely — no component, dialect or emulator change.
  `dialectCompare.ts` keeps every signature; the picker changes what fills
  `from`/`to`, not what is done with them. `?from=`/`?to=` keep their meaning
  and their values, so existing shared links are unaffected.
