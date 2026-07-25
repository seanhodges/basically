## Context

See `docs/contributing/architecture.md` for the layer map, the `Dialect` seam and
the store's bump-a-counter convention; this document assumes it rather than
restating it.

The relevant existing state is that four code paths independently decide what
lands in the editor, and the "starter" (`samples[0]`) is special-cased in three
of them:

- `initialDocument()` (`src/app/store.ts`) — first launch with no autosave gets
  the starter; later launches get nothing.
- `setDialect`'s empty-editor branch — switching machine loads the new machine's
  starter and its blocks.
- `setDialect`'s pristine-sample branch — swaps the same-named sample onto the
  new machine, falling back to the starter.

Document creation itself is `newDocument()` (`src/app/fileCommands.ts`): a
`confirmDiscard()` guard then `loadUnsavedDocument('')`. Samples are loaded from a
separate control, the Toolbar's File ▸ Samples section.

## Goals / Non-Goals

**Goals:**

- One entry point for document creation that carries machine, starting point and
  name, installed in a single atomic store update.
- Remove the starter concept outright, including the state it strands, so there
  is no residual "sometimes a sample appears" behaviour.
- Reuse the existing document-install, sample-block and AI hand-off machinery
  rather than adding parallel implementations.
- Keep the keyboard path to a new blank document at two keystrokes.

**Non-Goals:**

- Project templates beyond the bundled samples; a project browser; any change to
  Open/Save/Import/Export/Publish.
- Replacing the toolbar target selector — switching machine mid-program remains
  its job, along with `SwitchTargetDialog`.
- Retro-fitting focus-trapping or Escape handling onto the other dialogs.

## Decisions

### Dialect seam impact — additive and descriptive only

The seam gains three **required** fields on `Dialect` (`src/dialects/types.ts`):
`manufacturer: string`, `year: number`, `blurb: string`.

Required rather than optional so the type checker guarantees the picker is
complete — all registered dialects are updated in the same change, and a future
dialect cannot be registered without them. Nothing branches on these fields, so
the machine-agnostic contract above the seam is unchanged and no
`MachineEmulator` behaviour is affected. This is the change's only seam impact.

`Dialect.samples` keeps its shape; only its doc comment changes, since "the first
is the starter shown for a fresh document" stops being true (the same sentence
appears in each dialect's `samples.ts` header).

*Alternative rejected:* keeping the fields optional and falling back to the bare
name. It makes the picker quietly inconsistent as dialects are added, which is
exactly the class of drift the seam exists to prevent.

*Sourcing constraint:* machine facts must come from real hardware and primary
sources, never recall. Blurbs are derived from the in-repo
`docs/reference/<machine>/hardware.md` pages; each `year` is verified against a
primary source before being written.

### One atomic creation action, never `setDialect`

The dialog must not call `setDialect`. Doing so is wrong in both directions:
with user code in the editor it raises `SwitchTargetDialog` (a modal stacked on a
modal, asking a question the user has already answered), and with an empty editor
it currently auto-loads the starter — handing back a sample to a user who asked
for blank.

Instead the dialog gathers every choice locally and commits once, through a new
store action:

```
createProject({ dialectId, source, fileName, blocks? })
```

built on the existing `applyDialectSwitch()` helper so machine teardown,
AI-thread reset, breakpoint clearing and persisting the dialect choice match a
real target switch; then setting `fileName`, `dirty: false` and the blocks, and
calling `persistAutosave()`. This mirrors `openProject` (File ▸ Open), which
already bypasses the switch confirmation on the same reasoning: the project names
its own machine, so there is nothing left to resolve.

*Alternative rejected:* extending `loadUnsavedDocument` with a `fileName`. It
hard-codes `UNTITLED_FILE_NAME` deliberately — "only Open/Save name a document" —
and creation is now a third naming path, so a sibling action is honest where an
extra option would erode an existing invariant.

The `confirmDiscard()` guard runs **before** the dialog opens, so its
`window.confirm` never appears underneath a modal.

### Autosave must learn about names

`persistAutosave()` decides what is worth keeping purely from content: empty or
an unmodified sample is "pristine" and clears autosave. A named project that the
user has not yet typed into is pristine by that test, so its name would be lost
on reload — which the new naming feature makes reachable for the first time.

The pristine test gains a `fileName === UNTITLED_FILE_NAME` conjunct. Content
still decides for untitled documents, so nothing about existing behaviour moves.

### Removing the starter strands a setting

`hasLaunched` (`src/storage/settings.ts`, written from `src/App.tsx`) exists
solely to answer "is this the first launch, and therefore should the starter
appear". With the starter gone it has no remaining reader, so it is removed
along with its accessors, key and tests. `noUnusedLocals` catches anything
missed. The orphaned localStorage key needs no migration — a stale key is inert.

### Reuse for samples and AI

Sample blocks use the existing `materializeSampleBlocks()`
(`src/app/sampleBlocks.ts`) — the same call moving out of the Toolbar — so a
sample shipping machine code arrives assembled.

The AI starting point copies the established hand-off in
`src/components/DocsDrawer.tsx` (its "explain"/"convert" actions): create the
document, `showAiPanel()`, then `useAiStore.send()` with the dialect's system
prompt. The drawer's private `aiCredentials()` helper — resolve provider and key,
or open AI settings when absent — is extracted to `src/ai/credentials.ts` and
shared, rather than copied a second time.

### The description option is gated, not failed

The description starting point is disabled when no API key is set, with a note
explaining why and a link into AI settings — rather than accepting the choice and
creating a project whose defining feature silently does not happen. The drawer's
"resolve, else open settings" shape is right for a hand-off the user has already
committed to; it is the wrong shape for an option being offered, where the honest
answer is "not yet, and here's how". So creation gates on key presence up front,
and `aiCredentials()` remains the resolution helper for the send itself.

Two consequences that are easy to get wrong:

**Mount order in `src/App.tsx` decides the stacking.** Every modal shares
`z-index: 100` from `Dialog.module.css`, so DOM order alone decides what paints on
top, and `AiSettingsDialog` is mounted *first* in the list. Adding
`<NewProjectDialog />` in the natural place — at the end, beside `WelcomeDialog` —
would paint it over the settings dialog it just sent the user to. It must be
mounted **before** `<AiSettingsDialog />`. The creation dialog stays open
underneath, which is what makes "set a key and return" preserve the user's
in-progress choices.

**Key presence must be re-read, not snapshotted.** The API key lives in
localStorage (`getProviderApiKey`), not in the store, so nothing re-renders when
it changes. The dialog subscribes to `settingsOpen` — which does live in the
store — and re-reads key presence when it changes, so closing settings with a key
now set enables the option. This keeps the existing convention of reading
credentials imperatively rather than mirroring them into the store.

*Alternative rejected:* moving provider and key into the Zustand store to get
reactivity. It widens the blast radius to every credential reader for one
dialog's benefit, and puts a secret into a store that is otherwise serialisable
state.

### Dialog composition

`NewProjectDialog` follows the established pattern exactly: a component mounted
unconditionally in `src/App.tsx`, self-gating on a store flag, styled from the
shared `Dialog.module.css`. Because it sits on a keyboard hot path it adds
autofocus, Escape-to-cancel and Enter-to-create locally — the other dialogs are
left alone.

## Risks / Trade-offs

- **The boot-regression suite depends on the starter.** `e2e/plan/section03-emulator.spec.ts`
  boots every machine by selecting a dialect and pressing Play; the starter is
  what makes there be a program at all. Removing it would leave the suite passing
  while running an *empty* program on every machine — a silent loss of coverage,
  not a visible failure. → Rewrite it to create a project from a sample via the
  new dialog, and confirm the assertions still exercise a painted screen.
- **Three further specs and four documentation pages** reference File ▸ Samples or
  the preloaded starter, including the spec that generates the published
  screenshots. → All are listed in `tasks.md`; a shared e2e helper replaces the
  three separate sample loaders, and the screenshot output is reviewed after
  regeneration.
- **Loading a sample now costs a confirmation** when there is unsaved work, where
  the File menu previously used the same guard but reached it in one click. →
  Accepted: it is the same protection, and consolidating the entry point is the
  point of the change.
- **Required seam fields touch every dialect folder.** → Mechanical and
  compiler-enforced; the risk is factual accuracy, handled by the sourcing
  constraint above.
- **A modal on `Ctrl+N` is new friction on a hot path.** → Mitigated by
  pre-selecting the current machine and Blank, so the previous behaviour is
  `Ctrl+N` `Enter`; measured against the goal that nothing is chosen implicitly.
