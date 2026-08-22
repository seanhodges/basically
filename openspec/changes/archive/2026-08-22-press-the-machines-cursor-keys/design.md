## Context

The virtual keyboard is a pure data-driven renderer over each dialect's
`KeyboardLayout` (see `docs/contributing/architecture.md` for its place in the
app). A key carries two independent things: `emits`, the machine tokens it
presses, and per-layer `labels`, each of which may carry an editor action. The
first is fixed for the whole key; the second varies by layer. CURSOR mode is a
pinned layer, so it can only ever have changed the editor half - which is
exactly the bug.

## Decisions

**A legend may carry its own machine tokens.** `KeyLabel` gains an optional
`emits`, resolved the way its `editor` action already is: the active layer's
legend wins, otherwise the key's own `emits`. One keycap is then a letter on the
base layer and a cursor key under CURSOR mode, and the two halves of a legend -
what it does to the editor and what it does to the machine - are declared in the
same place. The alternative, a dedicated `cursorKeys` block on the layout, was
rejected: it would state cursor keys twice (once as data, once as legends) and
would only ever serve this one case, where per-layer tokens serve any future
layer that needs to press something different.

**The pinned layer is pushed into the engine, not pulled.** The engine resolves
a modifier-driven layer itself, but a mode-pinned layer is component state - the
mode tabs live in the keyboard, not the input engine. The editor target already
handles this by resolving the pinned layer inside its key-press callback; the
machine target has no such callback, because presses go straight to the matrix.
So the keyboard sets the pinned layer on the engine when the mode changes, and
the engine resolves tokens against it at press time.

Tokens are resolved once, on key-down, and recorded with the press. Release
already replays the recorded tokens rather than re-reading the key, so a mode
change mid-press cannot strand a held key - the same property that already makes
sticky modifiers and slide-offs safe.

**The chord machines press the chord.** Where a machine produces its cursor keys
by holding shift over another key, the legend emits that combination, because
that is what the machine's matrix sees. Nothing synthesises it centrally: the
Commodore machines already fold shift in behind their own token, and the
Sinclair machines have no such folding, so their legends carry both tokens. The
token refcount the engine keeps means a chord sharing a token with an engaged
modifier releases correctly.

**Cursor keys stay on W/A/S/D.** Five machines already put them there, it costs
no columns on a template that has none free, and one convention across the
registry beats a per-machine arrangement nobody can predict. A machine with
fewer than four cursor keys leaves the remaining keys alone rather than
inventing one: the PMD 85 has ← ↑ → and no down key, which its Monitor's
key-code table settles - the cell below its `|←` returns no code at all, and the
two beside it are halves of the wide ENTER.

**DEL is a real key, so the editor gains a real action.** `EditorKeyAction` has
no forward delete, which is why the PMD 85's delete key borrowed `backspace` and
a `⌫` legend to go with it. Adding `delete` lets the cap mean the same thing on
both surfaces instead of one thing per focus.

## Seam impact

None. `MachineEmulator` is untouched: cursor keys reach the matrix through the
existing `setKey(token, down)` with tokens each machine already understands
(they are the same ones its `keyEvent` maps physical arrows onto). No dialect
gains an interface member, and no machine-specific knowledge enters the keyboard
code - the change is one optional field of layout data plus the resolution that
reads it.
