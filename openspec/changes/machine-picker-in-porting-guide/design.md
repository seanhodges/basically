## Context

The porting guide chooses its pair with two native `<select>` controls in
`DialectCompare.vue`, grouped under `<optgroup>` headings whose labels come from
a `makerOf` map inlined in `compare.md`'s `<script setup>` — thirteen entries
restating the registry's `manufacturer`, with no test pinning them. The IDE
chooses a machine with `MachineTrigger` + `MachinePickerDialog`, illustrated by
`machineArt.tsx` and grouped by `machinePicker.ts`. Same act, two presentations,
and they sit a panel apart whenever the guide is opened in the IDE's docs
drawer.

The component layout and dialect seam this builds on are described in
`docs/contributing/architecture.md`.

**Dialect seam impact: none.** Nothing here crosses the `Dialect` /
`MachineEmulator` boundary, and nothing under `src/` is edited at all — the IDE's
picker is read as the reference, not modified. The `Dialect` fields this change
surfaces in the docs (`manufacturer`, `year`, `blurb`) are already declared and
already populated for all 13 machines; the docs restate them and the crosscheck
pins the restatement.

The binding constraint is unchanged from `compare-machines-not-pages`: **the docs
runtime must never import `src/`**, because `src/dialects/registry.ts` imports
every dialect index and each pulls in its emulator core. Only `*.test.ts` files
under `docs/` may import `src/` — vitest runs them in node and the VitePress
bundle never includes them. That is what forces the restate-and-pin shape below
rather than a shared import.

## Goals / Non-Goals

**Goals:**

- Choosing a machine in the guide looks and reads like choosing one in the IDE:
  same grouping, same portraits, same wording.
- Two machines of the same family can be told apart before the comparison is
  drawn, not only after.
- Every restated fact — manufacturer, year, blurb, portrait — is pinned to
  `src/`, so none of them can drift.
- `dialectCompare.ts` is untouched. The picker changes what fills `from`/`to`,
  not what is done with them.

**Non-Goals:**

- A shared component runtime between React and Vue.
- Editing anything under `src/`.
- Changing `?from=`/`?to=`, the sections below the controls, or what the
  comparison reports.
- New or redrawn artwork.

## Decisions

### Restate the portraits as neutral SVG; pin them by rendering the originals

`docs/reference/data/machineArt.ts` exports one entry per art id holding the
*inner* markup of that portrait as a string, plus the shared `'0 0 48 32'`
viewBox. Vue renders it with `v-html` inside an `<svg>` whose width/height the
caller sizes, which is the direct analogue of what the React components do.

The portraits are unusually well suited to this. `machineArt.tsx`'s own header
commits to fill-only shapes with no gradients and no `<defs>` — deliberately, so
that repeated portraits on one page cannot collide on gradient ids — and nothing
in them inherits `currentColor`. So a portrait is a self-contained run of
`<path>`/`<rect>` elements with literal fills: no theme coupling, no id
namespacing, nothing that changes meaning when it moves runtime. It renders
identically in the docs' light and dark themes for the same reason it renders
identically in the IDE's.

`machine-art-crosscheck.test.ts` imports `machineArt.tsx`, renders each portrait
with `renderToStaticMarkup` (`react-dom/server` is already a dependency), strips
the outer `<svg>` wrapper and the `aria-hidden`/`focusable` attributes the
wrapper carries, normalises attribute order and whitespace, and asserts equality
with the docs copy. It also asserts the two id sets match, so a machine drawn in
the IDE and missing from the docs — or the reverse — fails.

*Alternative considered: generate `.svg` files into `docs/public/` from the React
art and use `<img>`.* Rejected: it adds a generation step and a committed build
artifact to a repo that hand-authors every other piece of docs data, and an
`<img>` cannot take a `size` in the way the trigger and the list rows need
without a second dimension source. The crosscheck gives the same
cannot-drift guarantee without the pipeline.

*Alternative considered: extract the art to a dependency-free module under `src/`
and import it from the docs.* Rejected: it buys zero duplication at the price of
turning "the docs runtime never imports `src/`" into "the docs runtime never
imports `src/`, except this one file", which every future reader then has to
re-derive the safety of. The rule's value is that it needs no case analysis.

*Alternative considered: pin by hash rather than by markup.* Rejected — a hash
mismatch says "something changed" and nothing else. Comparing markup puts the
actual diff in the failure output, which is what the person fixing it needs.

### `machines.ts` grows the picker's fields; `makerOf` is deleted

`MachineChoice` gains `manufacturer`, `year` and `blurb`, matching `Dialect`
exactly. `machines-crosscheck.test.ts` already asserts `label` and `page` per
machine and extends to these three the same way.

This *removes* a restatement rather than adding one. `makerOf` in `compare.md`
is thirteen unpinned entries of the same information, sitting in a page's
`<script setup>` where no test looks; its own comment concedes "a machine
missing a heading just groups under its own label rather than breaking" — a
silent degradation. Moving it into the pinned list makes the failure loud and
puts all of a machine's docs facts in one file.

`blurb` is the one field with no equivalent in the current guide, and it is the
one that does the work the `<select>` could not: "The 1MHz cousin with a proper
keyboard" tells a reader which BBC they are looking at in a way "BBC Master"
alone does not.

### Port the two components; keep the logic in a plain sibling

`docs/.vitepress/theme/machinePicker.ts` mirrors
`src/components/machinePicker.ts` — `groupMachinesByManufacturer`,
`machineSummary`, `machineChoiceLabel`, and a trigger label — over the docs'
`MachineChoice` rather than `Dialect`. The IDE keeps its component logic in
plain `.ts` siblings for unit-testability and the docs theme already does the
same (`dialectCompare.ts`, `escapeTable.ts`, `referenceTable.ts`); this follows
both.

The IDE's `targetMachineLabel` returns `Target machine: <name>`, which is wrong
here — the guide has two fields and neither is "the target machine" in the IDE's
sense. The docs helper takes the field's role, giving
`Porting from: Commodore 64` / `Porting to: BBC Micro`, so the two triggers are
distinguishable to a screen reader. This is the one place the wording
deliberately diverges, and a unit test states why.

`MachinePickerDialog.vue` reproduces the React dialog's structure: a
`role="dialog" aria-modal="true"` panel, manufacturer `<h3>` headings, one
`<button type="button" data-machine="<id>" :aria-pressed>` per machine carrying
portrait, name, year and blurb, and a Cancel action. Focus moves to the pressed
row on open, matching the IDE's "open on the current machine, so the keyboard
starts where the eye does".

Dismissal is Escape plus an outside `pointerdown`, the same two gestures
`useDismiss` implements, written directly in the component rather than as a Vue
port of the hook — it is roughly ten lines and the docs theme has no other
consumer. `isOutside`'s composed-path test is the part worth copying exactly,
because it is what makes the trigger's own click read as "inside" and avoids the
double toggle.

*Alternative considered: `<dialog>` with `showModal()`.* It would give
focus-trapping and Escape for free. Rejected for now because VitePress renders
these pages server-side and `<dialog>` needs an `onMounted` guard either way,
and because matching the IDE's markup is what lets one set of e2e selectors
describe both. Worth revisiting for both surfaces together, not for one.

### SSR: the dialog renders nothing until it is opened

VitePress statically renders every page. The trigger is plain markup and renders
fine; the dialog is behind `v-if="open"` and so never renders during SSG, which
also keeps 13 portraits × 2 fields out of the pre-rendered HTML. The trigger's
own portrait does render — one per field, which is the point of it.

### e2e selects through the picker, using the IDE's hooks

`data-target-machine` on the trigger and `data-machine` on each row are carried
over verbatim from the IDE, including the reason they are distinct: machine
names prefix one another, so text is an ambiguous selector, and the two
attributes must not collide when both are on screen.

`convert-program.spec.ts`'s `frame.locator('select').nth(1).selectOption('cpc6128')`
becomes: click the "porting to" trigger, click `[data-machine="cpc6128"]`. The
`.nth(1)` positional index goes with it — a second field addressed by its
position in the DOM is exactly the kind of selector that breaks silently when a
control is added, and the trigger's role label gives it a name instead.

### The URL contract is untouched

`syncUrl` fires on choice as it fired on `change`, with the same values. Machine
ids are what the picker returns and what `?from=`/`?to=` already carry, so every
existing shared link keeps working and `deepLinkParams.ts` is not edited.

## Risks / Trade-offs

- **The portraits are now maintained in two places.** → This is the accepted
  cost of the import boundary, and it is the same bargain `machines.ts`,
  `facts.ts` and every reference table already strike. The crosscheck is what
  makes it safe: a redraw in `machineArt.tsx` fails the docs build's test run
  with a markup diff naming the machine. The risk that remains is a redraw
  *plus* a copied-across mismatch nobody reads — small, and no worse than the
  existing pinned data.
- **`renderToStaticMarkup` output is a React implementation detail.** A React
  upgrade could change attribute ordering or self-closing style and fail the
  crosscheck on a change nobody made. → Normalise before comparing (parse
  attributes into a sorted map, collapse whitespace) rather than string-equating
  raw output. The test compares shapes and fills, not React's formatting.
- **Two fields, two modals, one page.** Opening the "from" picker while the "to"
  picker is open would stack backdrops. → One `openField: 'from' | 'to' | null`
  in `DialectCompare.vue` rather than a boolean per trigger, so opening one
  closes the other by construction.
- **The guide is embedded in an iframe.** A modal inside the docs drawer is
  confined to the frame, so it cannot centre over the IDE the way the IDE's own
  picker does. → Acceptable: the frame is the reading surface and the picker
  belongs to the guide, not to the app. Worth checking the panel's `min(520px,
  94vw)` still fits the drawer's width at its narrowest.
- **Thirteen blurbs are new prose in the docs bundle.** → They are one line each
  and already written; the portraits they sit beside are larger. Negligible next
  to the reference tables.
- **A machine registered without a portrait.** The IDE degrades to `generic`
  rather than throwing, for the stated reason that art can lag registration. →
  The docs copy carries `generic` and the same total resolution, so the guide
  degrades identically instead of rendering an empty box.

## Migration Plan

No user data, no persisted state, no URL change — `?from=`/`?to=` keep their
values and their meaning, so every existing shared link resolves exactly as it
does today. The only external-facing difference is the control's appearance.

Rollback is a straight revert. Nothing is written anywhere a revert would
strand, and the crosscheck tests fail closed: if the docs copy is reverted and
the art is not, the mismatch is reported rather than shipped.

## Open Questions

- Should the trigger show the year (`showYear`) as the IDE's New-project dialog
  does, or only the name as its toolbar does? The guide's fields are wider than
  the toolbar's, and the year is a cheap way to separate a 464 from a 6128
  without opening the list — but it competes with the field's own "Porting
  from" label for the same glance.
