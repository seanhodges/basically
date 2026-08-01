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
  triggers, each opening a grouped picker. Not a second picker that *resembles*
  the IDE's — **the IDE's own picker components, rendered in the docs**. The
  swap, copy-link and convert-with-AI controls, and every section below them,
  are unchanged.
- Each machine is chosen by more than its name: its portrait, manufacturer and
  year are on the row, and the collapsed trigger keeps the portrait and name in
  view. Relatives stop being one word apart.
- The picker becomes shareable, which takes two edits under `src/` and changes
  no behaviour. It is typed against a five-field `MachineLike` — `id`, `name`,
  `year`, `manufacturer`, `blurb`, which is everything it actually touches —
  rather than the whole `Dialect`; and `MachinePickerDialog` takes its machines
  as a prop instead of reading the registry at module scope. `Dialect` satisfies
  `MachineLike` structurally, so every existing caller keeps working.
- `machines.ts` grows the fields the picker needs — `manufacturer`, `year`,
  `blurb` — and renames `label` to `name`, so `MachineChoice` satisfies
  `MachineLike` too and no adapter is needed on either side. All of it is pinned
  per machine by `machines-crosscheck.test.ts`, exactly as `label` and `page`
  already were.
- The docs mount the picker as a React island: a Vue wrapper that renders the
  React tree on mount, registered asynchronously so react-dom loads on the
  porting guide and nowhere else.
- The manufacturer grouping moves out of `compare.md`. The `makerOf` map
  currently inlined in that page's `<script setup>` — restating the registry
  with no test pinning it, and degrading silently when a machine is missing —
  is deleted in favour of the pinned `manufacturer` field and the shared
  `groupMachinesByManufacturer`.
- **The docs → `src/` import rule is restated, not removed.** It becomes "the
  docs runtime never reaches `src/dialects/registry.ts` or `src/emulator/`",
  which is the hazard the old rule was a proxy for, and a new import-graph test
  enforces it instead of a convention.
- The trigger's accessible name stops being hardcoded to the IDE's phrasing.
  `targetMachineLabel` returns `Target machine: <name>`, which is right in the
  IDE and wrong in the guide, where one of the two fields is the machine being
  ported *from*. The role becomes the caller's to supply, so the guide keeps its
  own words — `Porting from` / `Porting to` — while rendering the same
  component. Visible field labels are unchanged.
- **BREAKING (internal component contract):** `MachinePickerDialog` no longer
  reads the dialect registry itself and requires a `machines` prop; its two IDE
  call sites — `NewProjectDialog` and `TargetMachineDialog` — pass `dialects`.
  `MachineTrigger` gains a `role` prop; its three IDE call sites —
  `NewProjectDialog` and `Toolbar` ×2 — pass `Target machine`. No behaviour
  changes on either.
- **BREAKING (internal test contract):** `e2e/porting-guidance/convert-program.spec.ts`
  drives the target with `frame.locator('select').nth(1).selectOption('cpc6128')`.
  There is no `<select>` afterwards; it selects through the picker instead.
  Because both surfaces now render the same component, the IDE's existing
  `data-target-machine` / `data-machine` hooks work in the guide unchanged, and
  the two suites stop describing the same act two different ways.

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

  The delta additionally carries a **wording-only** tidy-up that changes no
  guarantee: three requirements and one requirement name still describe the user
  as selecting a *dialect*, which `compare-machines-not-pages` stopped being a
  thing the comparison offers — it made the machine the unit of selection but
  modified only the one requirement that names it. Those are corrected here
  rather than in a change of their own, since this is the next change to archive
  against this capability and the edits are one word each. They are marked
  MODIFIED and RENAMED so the archive applies them; nothing about them depends on
  the picker work, and reverting the picker would revert them too.

## Non-goals

- **Changing what the comparison reports.** Every section below the controls —
  the summary, capability groups, control codes, guidance, colour key — is
  untouched. This change ends at the two fields.
- **Changing how the picker behaves.** The IDE edits are a type narrowing and a
  prop; the dialog's grouping, focus-on-open, dismissal, labels and markup are
  as they are. If the IDE's picker looks or behaves differently afterwards,
  something has gone wrong.
- **Removing the docs → `src/` boundary.** It is narrowed to the hazard it
  guards and made executable. The docs still may not reach the registry or any
  emulator core, and a test now says so rather than a comment.
- **Extracting a shared package.** A workspace package or a `vite build --lib`
  step would enforce the same boundary structurally, but the repo has no
  `workspaces` key and no nested `package.json`; that is monorepo
  infrastructure bought for a guarantee an import-graph test already gives,
  with a worse failure message. Worth revisiting at a third consumer.
- **Redrawing or adding artwork.** The 13 portraits and the `generic` stand-in
  are used as they are.
- **The reference pages' machine switcher.** `docs/reference/<family>.md` pages
  and their tables keep whatever controls they have; only the porting
  comparison's two fields change.

## Impact

- **IDE picker** (`src/components/`): `machinePicker.ts` gains `MachineLike` and
  is retyped off `Dialect`; `MachineTrigger.tsx` likewise, plus a `role` prop;
  `MachinePickerDialog.tsx` takes `machines` and drops its registry import.
  Call sites: `NewProjectDialog.tsx` and `TargetMachineDialog.tsx` pass
  `dialects`; `NewProjectDialog.tsx` and `Toolbar.tsx` (two triggers) pass a
  role. `machineArt.tsx`, `machineArtIds.ts`, `useDismiss.ts` and all three CSS
  modules are unchanged and shared as they stand.
- **Docs data** (`docs/reference/data/`): `machines.ts` gains `manufacturer`,
  `year` and `blurb` and renames `label` → `name`;
  `machines-crosscheck.test.ts` extends to the new fields.
- **Docs theme** (`docs/.vitepress/theme/`): new
  `components/MachinePicker.vue` mounting the React tree, registered
  asynchronously in `index.ts`; `DialectCompare.vue` swaps its two
  `<label class="cmp-field">` blocks for it and drops `optionGroups`; a
  six-token shim maps the picker's CSS custom properties onto the docs surface.
- **Docs build** (`docs/.vitepress/config.ts`): gains a `vite:` section — it has
  none today — carrying `@vitejs/plugin-react`, already a devDependency.
- **Docs page** (`docs/reference/compare.md`): the inlined `makerOf` map is
  deleted and the `dialects` mapping passes the new fields through.
- **Tests**: `e2e/porting-guidance/convert-program.spec.ts` selects through the
  picker; new e2e covering that a machine can be told from its relative and that
  the picker is operable by keyboard; `src/components/machinePicker.test.ts`
  retargeted to `MachineLike` and now pinning the logic for both surfaces; a new
  import-graph guard test.
- **Not touched**: `dialectCompare.ts` keeps every signature — the picker
  changes what fills `from`/`to`, not what is done with them. `?from=`/`?to=`
  keep their meaning and their values, so existing shared links are unaffected.
  No dialect, emulator or `Dialect`/`MachineEmulator` seam change.
