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

**Dialect seam impact: none.** This change edits `src/components/`, but nothing
in it crosses the `Dialect` / `MachineEmulator` boundary: no dialect, tokenizer,
charset or emulator is touched, and no `Dialect` field changes. The picker
edits *narrow* what the components ask of a dialect — from the whole interface
to five fields — which loosens the coupling to the seam rather than adding to
it.

The binding constraint from `compare-machines-not-pages` was that **the docs
runtime must never import `src/`**, because `src/dialects/registry.ts` imports
every dialect index and each pulls in its emulator core. Two findings reopened
that constraint:

- The rule is a proxy. Of the picker's five modules, exactly one reaches the
  registry — `MachinePickerDialog.tsx:15`, a module-scope
  `groupMachinesByManufacturer(dialects)`. `machineArtIds.ts` imports nothing at
  all; `machinePicker.ts` imports only `import type { Dialect }`, erased at
  build. Two of the five are already safe to import today.
- The picker touches five `Dialect` fields in total: `id`, `name`, `year`,
  `manufacturer`, `blurb`.

So the components are already near-pure presentation, and the boundary is
stricter than the hazard it guards.

## Goals / Non-Goals

**Goals:**

- One picker implementation, rendered on both surfaces. Not two that agree.
- The IDE's picker behaves exactly as it does today.
- The hazard the import rule guarded — an emulator core in the docs bundle — is
  enforced by a test rather than a convention.
- `dialectCompare.ts` is untouched. The picker changes what fills `from`/`to`,
  not what is done with them.

**Non-Goals:**

- A shared package, workspace, or published module.
- Changing picker behaviour, markup or styling on either surface.
- Changing `?from=`/`?to=`, the sections below the controls, or what the
  comparison reports.
- New or redrawn artwork.

## Decisions

### Share the component; do not restate it

The first design here restated the 13 portraits as neutral SVG under `docs/` and
pinned them to the React originals with a crosscheck that rendered
`machineArt.tsx` through `renderToStaticMarkup` and compared normalised markup.
That is replaced by importing the components directly.

The crosscheck approach costs ~590 lines of restatement plus a test that must be
maintained forever, and its own risk list conceded the pin was brittle:
`renderToStaticMarkup` output is a React implementation detail, so an upgrade
that changes attribute ordering or self-closing style fails the test on a change
nobody made. A crosscheck test is a permanent tax paid to simulate what an
import gives for free. It earns that cost when an import is impossible; here it
is not.

What is shared, unmodified: `machineArt.tsx` (440 lines, 13 portraits, 110 SVG
elements), `machineArtIds.ts`, `useDismiss.ts`, and all three CSS modules
(`Dialog`, `MachinePickerDialog`, `MachineTrigger` — 215 lines). The art in
particular stops being something that *can* drift.

### `MachineLike` replaces `Dialect` in the picker

```
MachineLike { id, name, year, manufacturer, blurb }
```

Those five fields are everything `machinePicker.ts`, `MachineTrigger.tsx` and
`MachinePickerDialog.tsx` read. `Dialect` satisfies it structurally, so no IDE
caller changes; the docs' `MachineChoice` satisfies it once it gains
`manufacturer`, `year` and `blurb` and renames `label` to `name`. No adapter on
either side.

The reason to bother is subtler than "fewer fields". `src/dialects/types.ts` is
**not** types-only — it exports `CharsetError`, `hasFatalErrors` and
`fatalErrors` at runtime. Today's safety comes from the picker's imports being
`import type` and therefore erased, which makes the leaf *accidentally* safe
rather than *structurally* safe: a later contributor writing a value import from
the same module would not be doing anything obviously wrong. Declaring
`MachineLike` locally makes the shared leaves genuinely self-contained, which is
what lets the import-graph guard assert something clean.

*Alternative considered: keep `Dialect` and have the docs build a conforming
object.* Rejected — it puts an adapter in the docs whose only job is to satisfy
a type the docs cannot import, and it leaves `types.ts` in the shared set.

### The dialog takes its machines as a prop

`MachinePickerDialog.tsx:15` computes `groupMachinesByManufacturer(dialects)` at
module scope. That single line is the only registry reach in the picker and the
only thing that made it unshareable. It becomes a `machines: readonly
MachineLike[]` prop, grouped inside the component.

This finishes a sentence the component already started. Its own doc comment
reads: *"Deliberately controlled and store-free: the New-project dialog points
it at its own local choice, while the toolbar points it at `setDialect`. Keeping
the store out is what lets one component serve both without either caller's
semantics leaking into the other."* It was store-free but not registry-free —
the list was the one thing it still reached out and took. A third caller is
exactly the pressure that exposes that.

Grouping moves from module scope into the component, so it is memoised on
`machines` rather than computed once at import.

### The docs mount it as a React island, on the Mermaid two-hop pattern

A Vue wrapper (`MachinePicker.vue`) creates a React root in `onMounted` and
tears it down in `onUnmounted`. It owns one `openField: 'from' | 'to' | null`
for the pair, so opening one picker closes the other by construction — the IDE
has no two-field case, so this is the one piece of genuinely new logic.

**The wrapper must be registered with `defineAsyncComponent` and must
`import()` react-dom rather than import it statically.** This is mandatory, not
stylistic. `config.ts:27-38` records what happens otherwise: VitePress emits a
`<link rel="modulepreload">` for every *direct* dynamic import of the app entry
chunk, which is how mermaid's ~2.1MB reached the preload list of all 39 pages
when only one had a diagram. The Mermaid wrapper solves it with two dynamic hops
— async component registration, and an `import()` inside — and the picker uses
the same shape for the same reason.

*Alternative considered: a web component / `defineCustomElement`.* Rejected —
Vue is only a transitive dependency of VitePress, so a Vue custom element would
put Vue in the *app's* bundle to render a docs component, and a vanilla custom
element means authoring the picker a third time in an idiom that exists nowhere
in this repo, with shadow-DOM theming and Playwright selectors that pierce
shadow roots.

*Alternative considered: reimplement the picker in Vue and share only the data.*
That was the previous design in a cheaper form. It still duplicates ~320 lines
of markup and CSS and still needs the art shared somehow.

### The trigger names its own field; the guide keeps its own words

`targetMachineLabel` returns `Target machine: <name>`. That is correct in the
IDE, where there is one machine and it is the target, and wrong in the guide,
where one of the two fields is the machine being ported *from* — calling it a
target machine would be actively misleading, not merely terse.

So the role becomes the caller's to supply. `MachineTrigger` takes a `role`
string and builds `<role>: <name>`; the IDE passes `Target machine` at all three
of its call sites, and the guide passes `Porting from` and `Porting to`,
matching the words the page already uses. `targetMachineLabel` stays as the
IDE's thin wrapper so its meaning is still named somewhere, and the shared
helper underneath takes the role.

The guide's *visible* field labels are unchanged: `Porting from` and `to`, as
today. Only the accessible name is fuller — `to: BBC Micro` would not stand on
its own read out of context, whereas `Porting to: BBC Micro` does. A visible
label shorter than its accessible name is the normal shape here, not a
divergence.

*Alternative considered: override `aria-label` in the docs wrapper.* Rejected —
it leaves the shared component asserting something false about one of its
callers and relies on every future caller remembering to override it. Making
the role a parameter puts the fact that a trigger has a role into the component
that renders it.

### The two surfaces look identical

The docs picker is the IDE's picker, so any visual difference is a defect, not a
tuning decision. That is the point of sharing it, and it constrains two things
that would otherwise be free choices:

- **The trigger does not show the year.** `showYear` is off, as in the toolbar
  rather than in the New-project dialog. This was decided the other way first,
  on the reasoning that the year separates a 464 from a 6128 without opening
  the list; seeing it built settled it against. The maker and year go on a
  second line, which makes each collapsed control twice the height of the swap
  and copy-link buttons it sits beside, and wide enough for
  "Spectrum 128 / Sinclair 1985" whatever machine is named — so the two fields
  read as the heaviest thing on the page when they are only its first. Like the
  toolbar, this is a container decision and not a different picker: the maker
  and year are on every row of the list, which is where the choosing happens
  and where a reader weighing a 464 against a 6128 is looking. What the
  collapsed control keeps is the portrait and the name, which is what "the
  machine chosen remains identifiable" asks of it.
- **The six-token shim must reproduce the IDE's surface exactly**, not
  approximate it with the nearest VitePress equivalents. Values come from
  `src/styles.css`, verified side by side.

### SSG: the picker is client-only, with a reserved placeholder

VitePress statically renders every page; a React island cannot participate. The
wrapper is `<ClientOnly>` with a placeholder sized to the trigger, so the
picker's absence from the pre-rendered HTML costs a paint, not a layout shift.

This is a real regression against the pure-Vue alternative, where the trigger
would have been in the static HTML. It is accepted: the trigger carries no
content a reader needs before hydration — it names the machine they are about to
change — and the sections below it, which are the page's substance, render
statically as they do today.

### The styling transfers, because both surfaces are dark

The three CSS modules use six custom properties: `--bg-panel`, `--bg-raised`,
`--border`, `--text`, `--text-dim`, `--accent`. The docs are
`appearance: 'force-dark'` and the IDE has no light theme, so a shim defining
those six on the picker's root — values from `src/styles.css` — is the whole of
the theming work. Vite handles `.module.css` natively, so the modules need no
build configuration beyond the `vite:` section that gives the docs JSX.

### The boundary becomes executable

"The docs runtime never imports `src/`" becomes "the docs runtime never reaches
`src/dialects/registry.ts` or `src/emulator/`" — the hazard the original rule
was a proxy for. A test walks the transitive imports of each docs-importable
leaf and asserts the resolved set contains neither.

This is strictly better than the prose rule it replaces. The rule's stated
virtue was that it needed no case analysis; the test makes the case analysis
executable, which is the same virtue with a failure message attached. It also
catches the realistic regression — someone adding a registry import to
`machinePicker.ts` in six months — which the prose rule could only catch in
review.

## Risks / Trade-offs

- **react-dom in the docs bundle.** ~45KB gzipped. → Lazy, on one page, via the
  two-hop pattern. The check that it worked is inspecting the emitted chunks
  after `docs:build`, not trusting the pattern was applied.
- **The picker is absent from pre-rendered HTML.** → Placeholder sized to the
  trigger. Accepted, per the SSG decision above.
- **A React boundary inside a Vue app is a new thing to reason about.** → It is
  confined to one wrapper file with an explicit mount/unmount lifecycle, and the
  repo already has the analogous case in `Mermaid.vue` (a component whose real
  work happens outside Vue's render).
- **Docs TypeScript is never typechecked.** `tsconfig.app.json` includes only
  `src`; `tsconfig.node.json` only `vite.config.ts`; nothing covers `docs/`.
  Sharing makes this worse — a docs-side misuse of `MachineLike` fails silently
  at runtime rather than at `tsc`. → Add a docs project to `tsc -b` as part of
  this change. It is a pre-existing gap, but this change is what makes it bite.
- **Nothing would catch a portrait rendering wrong.** There is no
  `toHaveScreenshot` anywhere in `e2e/`, so the retype and prop refactor are
  verified by types and by e2e that reads `data-machine` attributes — neither of
  which sees pixels. → Compare the IDE's picker before and after by eye, and the
  two surfaces side by side. Named here because it is the one risk the test
  suite does not cover.
- **Two IDE call sites now pass a list they did not pass before.** A caller
  passing the wrong list would silently offer the wrong machines. → Both pass
  `dialects` from the registry, which is what the component read itself; there
  is no third list in the app to confuse it with.

## Migration Plan

No user data, no persisted state, no URL change — `?from=`/`?to=` keep their
values and their meaning, so every existing shared link resolves exactly as it
does today. The only external-facing difference is the control's appearance.

Rollback is a straight revert. The IDE changes are behaviour-neutral, so
reverting the docs half alone is also safe if the island proves troublesome —
`MachinePickerDialog` keeps working with a `machines` prop whether or not the
docs use it.

## Open Questions

None outstanding. The two that stood here — whether the trigger shows the year,
and how its accessible name handles a field that is not a target machine — are
settled in the Decisions above.
