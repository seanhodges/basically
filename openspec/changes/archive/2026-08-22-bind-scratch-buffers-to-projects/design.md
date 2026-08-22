## Context

`ScratchBuffer` (`src/app/store.ts`) is session-only state, deliberately absent
from the autosave signature, from `serializeProjectZip` (`src/storage/projectFile.ts`)
and from share links. This change makes it document-owned instead. For the module
map and the store's conventions, see `docs/contributing/architecture.md`.

**Dialect/MachineEmulator seam: no impact.** Nothing here reaches the machine
boundary. A scratch buffer holds text in the active dialect and carries no
machine state of its own; the existing rule that a machine switch discards
buffers is what keeps the seam out of it, and that rule is unchanged.

## Goals / Non-Goals

**Goals:**

- Scratch buffers save into, and restore from, the project bundle.
- Scratch buffers survive a reload via autosave.
- One clear ownership rule: the buffer set belongs to the open document, so any
  document replacement replaces it.
- No project bundle format version bump, and no breakage of existing bundles.

**Non-Goals:**

- Share links carrying buffers.
- Persisting breakpoints (for buffers or for the program).
- Making scratch edits dirty the document.
- Any project library / manager UI.

## Decisions

### Bundle layout: ordinal-named entries, name in the metadata

One zip entry per buffer at `scratch/<ordinal>.bas`, with
`scratch: [{ name, file }]` in `project.json`.

*Why not `scratch/<name>.bas`, mirroring `blocks/<name>.bin`?* Because block
names are validated unique identifiers (`isValidBlockName`), whereas scratch
names are free-form and explicitly non-unique — nothing in the app resolves a
buffer by name. Two buffers called "Scratch 1" would collide into one entry and
silently lose work. Ordinals cannot collide, and the display name riding in the
metadata keeps each entry a plain `.bas` the user can unzip and open, which is
the promise the bundle format makes for every other part.

*Alternative considered:* inline the text in `project.json` as the tape files and
boot disc do. Rejected — those are base64 blobs with no natural standalone file;
BASIC source is exactly the kind of part the bundle exists to keep as a file.

### No format version bump

`scratch` is an additive optional field, the same pattern `entry`, `asmSource`,
`autoStart`, `tapeFiles` and `bootDisc` all used. Bundles without it parse to no
buffers. Bumping to v3 would make every older bundle unopenable, since
`parseProjectZip` reads exactly one version — a severe cost for an additive field.

### Autosave: its own key, retained independently of the document

A new `mbide.autosave.scratch` key holds `[{ name, text }]`, loaded defensively
like the other autosave parts (a corrupt value yields none rather than throwing).

Two consequences follow from "buffers are autosaved but never dirty the
document", and both need deliberate handling:

1. **The buffer set joins the autosave signature.** `persistAutosave` skips its
   write when a content signature is unchanged, so a scratch-only edit would
   otherwise never be written. The signature is content-derived and not gated on
   `dirty`, so including buffers there does not touch the dirty flag.

2. **The document-retention rule stays exactly as it is, and the buffer key is
   written and cleared independently of it.** `persistAutosave` clears autosave
   for a pristine or deliberately-emptied document; buffers must not ride on that
   decision in either direction. Folding "has buffers" into the pristine predicate
   was considered and rejected: it would resurrect a named file the user
   deliberately emptied, breaking the spec'd "a deliberately cleared program stays
   cleared" guarantee. So a blank untitled document can clear its document
   autosave while its buffers persist.

### Clearing keys off the existing named-load discriminator

`replaceDocument` already distinguishes a named load (Open — clears the AI
thread, breakpoints and blocks) from an in-place assistant apply, on whether a
`fileName` was passed. The clear belongs inside that same branch, so "an apply
keeps the buffers" needs no new flag and cannot drift from the other
different-program resets.

`createProject` needs its own clear: it routes through `applyDialectSwitch`,
which only discards buffers when the *dialect* actually changes, so a new project
on the same machine would otherwise keep them.

### Restored buffer identity

Ids are re-minted by ordinal on load rather than persisted, matching how a loaded
block's id is synthesised from its name. Ids are internal handles; persisting
them would add a uniqueness invariant to enforce on untrusted input for no user
benefit.

### The discard guard gains a second trigger

`confirmDiscard` inspects only the dirty flag and the source. Since buffers stay
dirt-free by decision but New and Open now destroy them, unsaved snippets would
vanish with no warning at all. The guard gains "or scratch buffers exist", with
wording that names them.

*Alternative considered:* make scratch edits dirty the document, which would fix
this for free. Rejected — it would make the unsaved-changes marker light up for
work that is not the program, which is exactly what the current behaviour
protects against.

### Unknown-dialect fallback discards buffers

When a bundle names a dialect this build does not ship, the document still loads
under the active machine. Its buffers are dropped there: they hold code in a
dialect the machine does not speak, which is the same reasoning as the
machine-switch rule.

## Risks / Trade-offs

- **Users lose the workbench that outlived documents** → The old behaviour let a
  snippet follow you across programs; that is now impossible. Mitigated by the
  per-tab **Download .bas** action, which already exists, and by the new discard
  warning naming the buffers before they go.

- **Autosave payload grows with buffer contents** → Buffers are BASIC source for
  8-bit machines, so a large one is still kilobytes. The same storage-quota
  handling that already covers the document covers this; nothing new is needed.

- **A malformed `scratch` field fails the whole bundle open** → Consistent with
  every other bundle field: a corrupt project cannot be partially loaded, and the
  parse error already surfaces as a status notice. Autosave takes the opposite
  stance (tolerant) for the same reason it already does.

- **Two persistence paths for one piece of state can drift** → Both go through
  the same wire shape, as the block and tape-file codecs already do, and both are
  covered by round-trip tests.

## Migration Plan

No data migration. Bundles saved before this change carry no `scratch` field and
open with no buffers; bundles saved after it open in older builds as they always
did, since the unknown metadata field is ignored and the extra zip entries are
never read. The autosave key simply does not exist until first written.

## Open Questions

None outstanding — the four lifecycle decisions and the discard-guard extension
were settled before this change was written.
