## Context

Two surfaces choose a machine and share no code: an inline grouped grid in the
New-project dialog, and a flat `<select>` in the toolbar. This change replaces
both with one component. The component layout and dialog conventions this builds
on are described in `docs/contributing/architecture.md`.

## Dialect seam impact

**None.** Nothing here crosses the `Dialect` / `MachineEmulator` boundary. The
picker reads only metadata the seam already exposes (`id`, `name`,
`manufacturer`, `year`, `blurb`) and the toolbar path still routes every switch
through the store's existing `setDialect`.

## Decisions

### The picker is controlled and store-free

The picker takes `open` / `selectedId` / `onChoose` / `onDismiss` and holds no
store state of its own. This is what lets one component serve two callers whose
semantics genuinely differ: in the New-project dialog the machine is part of a
choice that has not been applied yet, so it drives local state; in the toolbar
it applies immediately through `setDialect`. Reading the store inside the picker
would force one of those meanings onto the other.

Consequently the two callers own the open flag differently — the New-project
dialog keeps it local, the toolbar keeps it in the store (it needs to, see
below).

### Illustrations are keyed by id, not carried on `Dialect`

Adding an `art` or `colors` field to `Dialect` would push a presentation concern
through the machine seam and oblige every future dialect to supply artwork
before it could be registered. Instead the artwork lives with the components and
is looked up by dialect id, with a neutral fallback for an id that has none — a
dialect can exist on disk before it is registered, and a newly registered one
may land before its portrait. A colocated test still requires every *registered*
machine to have one, so the fallback is a safety net rather than an escape
hatch.

Colours reuse the per-machine palettes already hand-authored for the virtual
keyboard wherever they exist. Those only ever cover keycaps and legends, so
every case colour is new; the ZX81 and ZX80 name a keyboard theme that has no
rules at all, so both are new throughout. The artwork records which is which.

### The toolbar's picker is mounted at app level

The toolbar establishes a stacking context, so a modal rendered inside it would
sit *below* other dialogs and the docs drawer regardless of its own z-index.
The toolbar's picker is therefore mounted with the app's other dialogs and
opened through a store flag — the same pattern every other modal here uses.

Choosing closes the picker *before* applying the switch, because a switch the
user must resolve raises the target-switch confirmation, which would otherwise
appear underneath it.

### Nested modals: one dismissal owner at a time

In the New-project dialog the picker opens on top of an existing modal, which
dismisses itself on any outside pointer-down or Escape. Two mechanisms keep that
from closing both:

1. The picker renders **inside** the dialog's own subtree, so a press on the
   picker is not "outside" the dialog. Its overlay still covers the viewport —
   nothing above it establishes a containing block.
2. The dialog's dismissal is **suspended while the picker is open**, so Escape
   reaches only the picker. Dismissal re-arms after the picker closes, so the
   keypress that closed it cannot also close the dialog.

Both are needed: (1) alone leaves Escape closing both, (2) alone leaves an
outside-press closing both.

### Year and description after collapsing

The collapsed control names the manufacturer and year (the group heading that
carried them is no longer on screen) and keeps the selected machine's
description beneath it. Every other machine's year and description move into the
picker rows, where they are now shown for *all* machines rather than only the
selected one — so the "described well enough to choose between" guarantee is met
more fully than before, on both surfaces.

## Risks

- **Test surface.** The toolbar `<select>` was the hook the end-to-end suite used
  to both switch machines and read back the active one. Both roles move to
  attributes on the new control, touching most specs that mention a machine.
  Mitigated by putting the switch behind one shared helper.
- **Legibility at small sizes.** The illustration is the only machine identifier
  left in the toolbar's narrowest tier. The control keeps naming the machine in
  its accessible name and tooltip, so nothing is identifiable *only* by picture.
