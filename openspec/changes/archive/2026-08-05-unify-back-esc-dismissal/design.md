## Context

Two mechanisms grew independently and neither is complete (see `proposal.md` for
the user-visible cost). The layering is described in
`docs/contributing/architecture.md`; what matters here is that both mechanisms
observe the same single Zustand store, but each keeps its own hardcoded idea of
which parts of it count as "a surface".

- `src/app/historyNav.ts` — a well-tested state machine (295 lines of coverage in
  `historyNav.test.ts`) that maps surfaces onto History API entries so Back closes
  them in LIFO order. Its weakness is not the machine but its input: `NavSnapshot`
  is a fixed six-field interface, so every field is named four times over
  (`computeSnapshot`, `snapshotsEqual`, `openKeys`, `applySnapshot`). Adding a
  surface means editing four functions.
- `src/app/useDismiss.ts` — an opt-in hook a component calls for outside-click and
  Escape. Nothing enumerates its users, so "which dialogs handle Escape" is only
  answerable by grep.

Because the two share no notion of ordering, nesting has already needed a manual
patch: `NewProjectDialog` passes `open && !pickerOpen` to `useDismiss` so that
Escape closes the machine picker it opened rather than both at once.

## Goals / Non-Goals

**Goals:**

- One list of dismissible surfaces, so adding a dialog cannot silently miss either
  gesture.
- Escape and Back provably cannot diverge.
- Preserve the two subtle behaviours already encoded in `historyNav`: an
  auto-shown keyboard does not consume a Back press, and Back from a fully-closed
  state leaves the app.
- Keep the existing history state machine and its tests intact.

**Non-Goals:**

- Changing what any dialog does, or how it looks.
- Focus management or focus trapping within modals — a real accessibility gap, but
  a separate concern with its own decisions to make.
- Converting the modals to the native `<dialog>` element, which would bring its own
  Escape semantics and restyle every dialog. Worth doing; not here.
- Deep-linking surfaces to URLs. History entries stay opaque, as today.

## Decisions

### Escape is defined as Back, not implemented alongside it

Rather than teach Escape its own notion of "the topmost surface", Escape asks the
history stack to pop: if any surface is open, it calls `history.back()` and the
existing `popstate` path does the rest.

This is the load-bearing decision. Two mechanisms diverged because they were two
mechanisms; giving Escape its own ordering logic — even reading from a shared
registry — would leave two code paths that could drift again. Routing Escape
through `history.back()` leaves exactly one implementation of "what closes next",
so the equivalence the spec requires holds by construction rather than by test.

*Alternative considered*: a shared registry consulted independently by both, with
Escape calling the surface's close action directly. Rejected — it keeps Back and
Escape as separate consumers, so a future surface can still be wired into one and
not the other, which is precisely today's bug.

*Cost*: `history.back()` is asynchronous, so Escape closes a surface on the next
task rather than synchronously. `historyNav` already handles exactly this for
UI-initiated closes (its `selfPopInFlight` guard exists because a user can act
during the round trip), so the asynchrony is not new. Rapid repeated Escapes
queue as ordinary history navigations.

### The registry replaces the snapshot's fields, not the state machine

A new `src/app/surfaces.ts` holds one entry per surface: its key, how to read its
value from the store, whether that value counts as open, how to apply a value back,
and whether it is layout-gated. `NavSnapshot` becomes a record keyed by surface id,
and the four functions that name fields become loops.

The state machine — push/replace/go, the `applyingPop` re-entrancy guard,
`selfPopInFlight`, the entry stack — is deliberately untouched. It is the part
that is hard to get right and the part that is already covered; the change is
confined to its input.

Surfaces carry a value rather than a boolean because several are not booleans:
the docs drawer restores a topic, the mobile tab restores which tab, and the
block dialogs restore an id. `historyNav` already special-cases `docsTopic` for
this reason; the registry generalises it instead of adding more special cases.

### Confirmations close through their existing cancel actions

`cancelRemoveBlock()` and `cancelDialectSwitch()` already exist and already mean
"decline safely". The registry's apply-to-closed path for those surfaces is the
cancel action, so the spec's guarantee is inherited from the store rather than
re-derived. No new "was this destructive?" concept is introduced.

### `useDismiss` keeps its job but claims the keypress

Toolbar menus, the editor tab menu and the docs hint are transient popups held in
component state, not screens. They stay on `useDismiss` — putting a dropdown into
browser history would be wrong.

To stop a single Escape both closing a menu and popping a history entry,
`useDismiss` calls `preventDefault()` when it handles Escape, and the global
handler bails on `defaultPrevented` as it already does for the editor and
emulator. Ordering works out: `useDismiss` listens on `document`, the global
handler on `window`, and document-phase bubble listeners run first.

This also retires the `open && !pickerOpen` patch in `NewProjectDialog`: both that
form and the machine picker are real surfaces on the shared stack, which orders
them.

### Two surfaces move from component state into the store

The variable-detail view and the gamepad remap picker are held in `useState`.
History cannot restore component state across a `popstate`, so they cannot
participate while they live there. Both move into the store — mechanical, and the
difference between complete coverage and coverage with two unexplained holes.

### The docs frame reports Escape over the channel it already has

The drawer is an iframe, so while focus is inside it the host window never sees
the keypress — no amount of host-side handling can fix this. The docs theme
already posts `basically:docs-close` for its in-frame close button, and the host
already translates that to `closeDocs()`. The frame gains an Escape listener that
calls the same `closeDrawer()`, attached only in the embedded branch so the
standalone docs site is unaffected.

## Risks / Trade-offs

- **The history rework regresses Back.** → The state machine is unchanged and
  `historyNav.test.ts` must pass untouched; only its input shape changes. The
  existing `e2e/shell/back-navigation.spec.ts` covers the six current surfaces
  end-to-end.
- **A dialog is added later and misses both gestures again.** → A unit test
  asserts every overlay flag on the store has a registry entry, so the omission
  fails CI rather than shipping. This is the check that stops the bug recurring.
- **Escape's asynchrony is visible.** → Same path the existing UI-initiated close
  already takes; `selfPopInFlight` already covers a user acting mid-flight.
- **Eleven modals now consume history entries.** → Long dialog sessions lengthen
  the history stack, but entries are popped on close, so the stack stays balanced;
  this is the behaviour the six existing surfaces already have.
- **Escape reaches a surface the user meant to keep.** → Only where nothing else
  claims the key. Editor, emulator and `useDismiss` consumers all take priority
  through `defaultPrevented`.

## Impact on the Dialect / MachineEmulator seam

None. This is shell behaviour: no dialect, emulator, tokenizer or transfer code is
touched, and no new machine-specific branch is introduced.

## Open Questions

- Whether a new `shell-navigation` capability needs a matching `e2e/` folder, or
  whether the existing cross-cutting `e2e/shell/` folder already satisfies the
  folder↔capability guard in `src/e2eCapabilityLayout.test.ts`. Resolved during
  implementation by running that test.
