## Context

`EditorTabBar` renders the strip above the editor: the BASIC tab, one per memory
block, one per scratch buffer, then a bounded number of the files a running
program has saved, then a `+` button whose menu creates a buffer or a block. See
`docs/contributing/architecture.md` for where the component and the store sit.

Today the strip is `overflow-x: auto` and its content is unbounded except for
saved files, which are capped at four with a `+N` button opening the
`VfsInspectorDialog` modal. So the strip has two overflow behaviours and neither
is good: block and scratch tabs scroll off silently, and saved files leave the
strip entirely for a dialog that re-lists what the tabs already show.

The tabs the strip draws come from three different places — `useBlocks()` and
`scratchBuffers` off the app store, and `useDataBlocks()` projected live from
`emulatorVfs` — with no shared identity between them: `ActiveTab` is a
discriminated union, and a block, a buffer and a file are told apart by `kind`.
Any strip-wide rule needs one key per tab first.

## Goals / Non-Goals

**Goals:**

- One overflow rule for every tab in the strip, replacing the two that exist.
- The BASIC tab always visible, at the front.
- Fit decided by the strip's real width, so the rule adapts to the window, to a
  phone, and to a long block name.
- The choice of which tabs are visible is a pure function, unit-testable without
  a browser.
- The "Emulator files" dialog and everything written only for it goes.

**Non-Goals:**

- Reordering tabs. Recency picks which are visible, never where they sit.
- Persisting which tabs were visible, or the recency behind it.
- Any new view of a saved file. The data tab's byte view is unchanged, and the
  dialog's hex dump is not reproduced anywhere.
- Any change to the `Dialect` / `MachineEmulator` seam. Nothing here is
  machine-specific: the strip's rule is the same on every registered machine, and
  the only dialect input remains `unwrapStoredFile`, which the data-block
  projection already consumes and which this change does not touch.

## Decisions

### Measure the strip rather than cap the tab count

The rule is "as many as fit", so the fit has to be measured: the bar's own width
from a `ResizeObserver`, and each tab's rendered width. A constant cap was the
cheaper option and is what exists today for saved files, but it wastes a wide
window and still overflows a narrow one — the same complaint on both ends that
made scrolling unsatisfying in the first place.

Measuring only the tabs *on screen* does not work: a tab dropped by the last pass
measures zero, is then judged to fit, is shown again, and the strip oscillates. So
every tab stays rendered and laid out, and the ones that did not fit are taken
offstage instead of out — absolutely positioned, `visibility: hidden`,
`pointer-events: none`, `tabIndex={-1}` and `aria-hidden`. Their widths stay
readable in a layout effect; they are not reachable by pointer, keyboard or
screen reader, and the overflow menu is what lists them. This is cheaper than a
duplicate hidden strip and cannot drift from it, since the thing measured *is*
the tab.

A width once taken is kept rather than re-measured every render: a scratch tab
mid-rename is an input rather than a tab, and dropping its width there would drop
the buffer out of the strip while it is being renamed.

The bar is `flex: 0 0 auto` in a column, so hiding tabs does not change the bar's
own width and the `ResizeObserver` cannot be fed by its own effects.

### Recency as a timestamp, not a list

An MRU list of tab keys would need a separate rule for a tab that arrives without
being activated — which is exactly how a saved file arrives. A file already
carries `updatedAt`, stamped with `Date.now()` by the file store, so recording
activation as `Date.now()` too puts both on one comparable scale: a tab's recency
is its activation stamp, or for a saved file never activated, the moment the
program wrote it. A file written a second ago outranks a block last shown a
minute ago, with no arrival rule of its own. Ties break on the strip's order.

The stamps are transient state on the app store, cleared wherever `activeTab`
already resets to the BASIC tab. Every site that writes `activeTab` stamps —
creating a buffer or a block activates it, which is what makes a new tab count as
new — so the stamp is written next to `activeTab` rather than only inside
`setActiveTab`.

### A bounded share for saved files

Recency alone lets a program that saves in a loop fill the strip with very recent
data tabs and push every block and scratch tab into the overflow. BASIC is pinned,
so the program is never lost, but the user's own tabs should not be evictable by
machine output either. Saved files are therefore admitted only until a bound is
reached, and compete freely below it. This is what keeps the existing guarantee —
that no program can take the strip over by writing files — true of the whole strip
rather than only of BASIC.

### The trailing buttons' width is a constant

The add-a-tab and overflow buttons are budgeted at a fixed, generous width rather
than measured. Measuring the overflow button would let its own width decide
whether it is drawn at all, and a border case could flip between the two on every
frame; a constant cannot. The cost is at most a few pixels of unused strip.

### Two passes for the overflow control's own width

The overflow button needs room only when there is overflow, which is not known
until the fit is computed. Rather than reserving its width permanently (a visible
gap whenever everything fits) the selector runs the fit once without it, and if
anything was left over, runs it again with it. Exact, and cheap enough at this
size to be worth preferring over an approximation.

### Admission stops at the first tab that does not fit

Continuing down the ranking to find a narrower tab that still fits would order the
visible set by width, which reads as arbitrary — a tab appears while a more
recently used one does not, for no reason the user can see. Stopping is the
predictable rule.

### The overflow control reuses the strip's own menu

The `+` add-tab button already anchors a menu under itself and dismisses it with
`useDismiss`. The `+N` button becomes a second instance of exactly that, listing
the hidden tabs by name and kind glyph, each item activating its tab. No dialog,
no store state, no shortcut — which is the point of the change.

## Risks / Trade-offs

- **Every tab stays in the DOM, including the ones not shown.** → They are laid
  out but painted nothing, and are out of reach of pointer, keyboard and screen
  reader. The cost is the layout of a handful of hidden buttons, against a
  duplicate measuring strip that could drift from the real one.

- **Measured layout is hard to prove in a unit test.** → The decision — which tabs
  are visible given widths, recency and a budget — is a pure module with its own
  tests; only the measurement itself needs a browser, and that is one e2e
  assertion on a resized viewport rather than a matrix.

- **A tab can leave the strip while the user is looking at it, if the window
  shrinks.** → The tab being shown was just activated, so it is the most recent
  and wins the ranking; the selector's tests assert it, rather than a second code
  path enforcing it.

- **The dialog's empty-state message has nowhere to go.** → On a machine whose
  emulation does not trap saved files, the dialog said so; an empty strip cannot.
  Recorded as a non-goal in the proposal, with the fact moving to the guide.

- **A very narrow window may fit nothing but BASIC.** → Correct behaviour rather
  than a failure: the overflow control then holds everything, which is how a phone
  should read.

## Migration Plan

None. There is no stored state to migrate: `vfsInspectorOpen` is transient, and
the recency stamps this change adds are transient too. A user with the old build's
`Mod+Alt+F` habit finds the shortcut inert; the guide's shortcut table loses the
row in the same change.
