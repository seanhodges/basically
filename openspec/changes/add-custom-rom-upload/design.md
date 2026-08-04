## Context

How a machine is built and run is described in `docs/contributing/architecture.md`;
this document covers only what changes.

Today the app resolves one ROM image per machine: the dialect declares a URL, the
emulator pane fetches it, and the bytes go to `createEmulator` as `rom`. That is
the documented seam, and for the Sinclair and Amstrad machines it is the whole
truth — those emulators execute exactly those bytes.

It is not the truth everywhere. Six registered dialects declare a ROM URL that the
app fetches and then discards: the Acorn machines delegate to jsbeeb, which
resolves its model's ROM list through its own loader, and the Commodore machines
fetch their three- and six-image sets themselves. On those, the seam's `rom` is
dead weight. The declared URL still earns its keep — it warms the offline cache
and names a representative image for tests — but nothing executes it.

That asymmetry is the whole design problem. A settings control that offers "replace
this machine's ROM" must be offered on exactly the machines where replacing it
changes something, and the app has no way to tell them apart: a declared URL is
present on both kinds.

### Impact on the Dialect / MachineEmulator seam

The seam **grows by one optional field on `Dialect`**: `romBytes?: number`, the
exact size of the image the machine runs from `opts.rom`.

`createEmulator`'s signature is unchanged. No `MachineEmulator` member is added,
removed or changed. No machine gains a new constructor parameter. The image
already flows through `opts.rom`; this change only alters which bytes are put
there, and adds a way to ask whether putting different bytes there would matter.

No tokenizer, transfer or editor code is touched.

## Goals / Non-Goals

**Goals:**

- A user can run a machine on their own firmware image, and get back.
- The offer and the size check cannot disagree with each other, or with the
  machine's own memory map.
- A machine that ignores the supplied image cannot accidentally offer to replace
  it — not now, and not after a future refactor.
- A failure to store an image is visible.
- A machine with no bundled image is a designed state, not a stack trace.

**Non-Goals:**

- Multi-image machines, image validity beyond size, a different BASIC, share-link
  transport, cross-tab sync — see the proposal's Non-goals.
- Registering the Altair 8800.

## Decisions

### D1. One field carries both "replaceable" and "what size" — `romBytes`

`romBytes?: number` is declared only where the seam's `rom` is what the CPU
executes. Its **presence** is the app's test for "can this be replaced?"; its
**value** is the size a replacement must match.

The two facts are deliberately not split. A boolean plus a separate size can
disagree — a machine marked replaceable with the wrong size, or a size recorded
for a machine that ignores it — and nothing would catch it. Fused, the control is
offered only where a size is known, and the size checked is by construction the
size of the thing being replaced.

*Alternatives considered.* **Deriving it from the declared ROM URL** is the
obvious move and is wrong: that is the very predicate the six ignoring dialects
would pass, which would put a live upload control on machines where it does
nothing — the worst available outcome, because it looks like it worked.
**A `romReplaceable: boolean`** invites drift from the size. **Declaring the slots
a machine has** is the right shape for the multi-image machines and is what that
future change should introduce; it is more structure than one image per machine
needs, and adopting it now would mean designing the slot vocabulary without the
machines that motivate it.

*Why it will not drift.* Each dialect sets the field from the ROM-size constant
its own memory already uses (`ROM_BYTES` on the Sinclair machines, `CPC_ROM_SIZE`
on the Amstrads) rather than a fresh literal, chaining three sources of truth:
the committed file, the declared size, and the array the CPU reads. A test pins
the first two together, and — more importantly — pins the *behavioural* claim in
both directions: for every dialect declaring `romBytes`, running on a zero-filled
image must produce a different screen from running on the real one; for every
dialect not declaring it, the two must be identical. The day someone wires
`opts.rom` into an Acorn or Commodore machine, that second assertion fails and
says to declare the field.

### D2. The image lives in `localStorage`, in its own module

**Not IndexedDB.** The worst case is six machines × 32 KB ≈ 262 K base64
characters, roughly 5% of the origin's pool; the autosave slot already carries a
boot-disc image of comparable size. RxDB is present in the tree but is reached
through a dynamically imported chunk, needs a storage seam in every test that
touches it, and carries a schema version to migrate later — all on a path that is
currently one synchronous read. It also models a different lifetime: the existing
database holds session-scoped program output that is cleared on every stop, and a
firmware choice is a durable preference that must survive exactly the events that
clear it.

**Not inside `src/storage/settings.ts`.** Every writer in that file swallows quota
errors by design — autosave and preferences are best-effort, and the comments say
so. An installed ROM must not inherit that: an upload that silently did not
persist is indistinguishable from a broken feature. Rather than contradict a
documented house style in place (and invite a later editor to "make it
consistent"), the store gets its own module with its own contract: the write is
attempted, the key is **read back and its decoded length compared**, and the
caller is handed a reason on failure.

`src/storage/customRom.ts` keys one entry per machine (`mbide.customRom.<id>`,
mirroring the dialect-scoped controller bindings) holding the file's name, size,
install time and base64 bytes.

*A side benefit that is not the reason but is worth recording:* `localStorage` is
synchronous, so resolution adds no `await`; and it raises `storage` events across
tabs, so the cross-tab sync ruled out in the proposal stays a cheap option rather
than a rewrite.

### D3. Resolution happens where machines are built, not in the store

The emulator pane's `ensureMachine` is the app's only machine construction site.
Reading the installed image there — directly from storage, not through a store
selector — has three consequences, all wanted:

1. **The player gets it for free.** The player renders the same pane, so a
   locally installed image applies there with no extra hydration. Routing through
   a store selector would have required the player to seed that state.
2. **The fetch cache cannot be poisoned.** The cache is keyed by the bundled URL
   and the custom path never touches it, so "restore bundled" is a cache hit —
   offline included — and needs no invalidation.
3. **A machine that ignores `opts.rom` cannot be affected**, because the lookup is
   gated on `romBytes`, which such a machine does not declare.

An installed image whose size no longer matches what the machine declares is
dropped and the bundled image used. This costs one comparison and means a future
change to a machine's ROM size cannot resurrect an incompatible stored image into
a constructor that would throw.

### D4. Installing or removing an image rebuilds the machine

The pane already tears down and rebuilds on a dialect switch, for exactly this
reason — the comment says "so the next run builds a fresh one with the new
dialect's ROM". Changing the ROM within a dialect is the same event, so it reuses
the same teardown, triggered by a counter bumped on install and removal, following
the store's established convention for cross-module commands.

Tearing down a *running* machine is deliberate: leaving the old firmware executing
while Settings reports a new image is a lie, and the change is always an explicit
act in Settings, never incidental.

The store holds **metadata only** — name, size, install time. The bytes stay in
storage and are read at construction. Machine-sized arrays in a subscribed store
invite re-render work and bloat every devtools snapshot, and nothing that renders
needs them.

### D5. An unavailable ROM is a designed state

Three changes make "no bundled image" a supported condition rather than a fetch
error, which is what lets the attribution file's claim about removable images be
literally true:

- The fetch helper **evicts a rejected fetch** instead of memoizing it for the
  page's lifetime. Without this, one offline failure would make "restore bundled
  ROM" permanently broken — a latent bug today, reachable only once restoring is
  possible.
- When a machine that can take a replacement has no image available, the failure
  names the size required and points at Settings.
- When a run fails while an installed image is in force, the message says so, so
  the user can tell a bad image from a bad program. This is the only automatic
  recovery hint available for an image that is the right size but wrong, and it
  is the answer to the one risk this design cannot engineer away.

### D6. The control is scoped to the machine in front of the user

Settings addresses the active machine, as the gamepad section already does, and a
machine that loads its own ROM set says so in place of the control. A manager
listing every machine's image is more surface for a setting most users will never
open, and the natural moment to change a machine's firmware is while looking at
that machine.

The wrong-size message names **both** the file's size and the required size.
For the two-bank machines — the 128K Spectrum and both CPCs — the likeliest
mistake is supplying one 16K half of a 32K image, and only naming both numbers
tells the user that is what happened.

## Risks / Trade-offs

**A correctly-sized but wrong image gives a machine that does not start.** Accepted
and unavoidable; see the proposal's Non-goals for why validating further defeats
the purpose. Bounded by: Settings is independent of the emulator, so the restore
control is always reachable — including on the tabbed mobile layout, where
Settings is a sibling pane rather than a modal; the readout always names the image
in force; the run-failure message says an image is installed; and the length
guards turn a truncated image into a named error rather than a hang.

**Screen reading degrades quietly on a rearranged image.** Character recognition
builds its glyph signatures from the live ROM at a fixed offset, so an image that
keeps its font where the stock one does still reads correctly — a real and
pleasant property, not a coincidence to rely on. An image that moves it reads back
as blank, which weakens the assistant's screen checks without announcing itself.
Documented as unsupported rather than detected: detecting it means recognising a
font we have no reference for.

**Private browsing stores nothing durably.** The storage hardening layer
substitutes an in-memory stand-in when site data is blocked, and it reads back
cleanly — so the write check cannot catch it, and the image vanishes on reload.
Handled by having that layer report whether it substituted, and saying so in the
control. This is the one silent failure the read-back does not cover, and it is
worth closing precisely because the whole point of the module's contract is that
storing an image never fails silently.

**One more optional field on the seam.** Additive, and it documents a fact about
the seam that was previously true but unwritten: `opts.rom` is not load-bearing on
every machine. The test that pins it in both directions is the real deliverable
here — it makes an implicit asymmetry explicit and enforced.
