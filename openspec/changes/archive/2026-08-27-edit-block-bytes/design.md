## Context

The intent is preserved from `docs/contributing/memory-blocks-edit-export-and-plan.md`
(Stages 1–2) — a plan removed from the tree once the rest of it shipped, and
readable in git history. A byte editor was specified there as the *first* write
path for blocks; the assembly editor overtook it and shipped first, leaving the
byte path unbuilt and data blocks with no editor at all.

That plan also specified a hand-rolled grid and a bespoke on-screen hex keypad.
Both were reconsidered against the tree as it now stands, and both are reversed
below. The reasoning is recorded rather than quietly dropped, because the
original arguments were sound about a codebase that has since grown the pieces
that answer them.

See `docs/contributing/architecture.md` for the dialect seam and the store's
command-bus conventions; this change alters neither.

**Dialect/MachineEmulator seam: no impact.** The byte editor consumes
`CharsetMapping` and `keyboardLayout` through the existing `Dialect` interface
and adds no field to it, and it never touches `MachineEmulator` — a block's bytes
reach the machine at load time exactly as they do today.

## Goals / Non-Goals

**Goals**

- Every block the IDE lets a user create has somewhere to edit it.
- Byte editing that behaves like the hex editors this audience already knows:
  fixed geometry, overwrite, and a byte that stays at the address it had.
- The editing rules and the byte/document mapping live in pure modules, testable
  without a DOM, so the component is a rendering concern.
- Usable on a phone, where the IDE already expects to work.
- Consistent with the block editor that already exists, rather than a second
  surface with its own conventions.

**Non-Goals**

- Competing with the assembly editor for code blocks (see the proposal's
  non-goals — the bytes/assembly authority question stays closed).
- Any structured or typed view of a block's contents.
- Byte-range selection by dragging (see the proposal's non-goals).

## Decisions

### CodeMirror as a render engine, not a hand-rolled grid

The retired plan argued for a hand-rolled grid on the grounds that a hex editor
is a fixed-geometry, two-column, overwrite-mode surface whose caret addresses a
*byte* while CodeMirror's addresses a character offset in a mutable, insert-mode
text document — so every one of those properties would have to be fought.

That argument holds against *using CodeMirror as a text editor and constraining
it*. It does not hold against using CodeMirror as a rendering, caret, scrolling
and selection engine over a document that is a **projection of the byte array**,
with text input switched off so the only writer is the surface's own dispatch.
Under that framing each objection is already answered in this tree:

- **Insert-mode editing.** Nothing to fight once ordinary input cannot reach the
  document. The surface owns every change it makes.
- **A caret that addresses a character.** `binaryLineWidget.ts` and
  `controlChipWidget.ts` both use `EditorView.atomicRanges` to make the caret
  treat a span as one indivisible unit. That is byte-granular caret movement,
  already built and tested here.
- **Fixed geometry.** The bundled charset faces in `src/styles.css` carry pinned
  `size-adjust` and ascent/descent overrides specifically so a machine graphic
  advances identically to a text character — the comment there notes the editor
  derives its row height from rendered content and an unpinned fallback would
  resize rows the moment a graphic appeared. A row mixing hex digits and machine
  glyphs therefore already lines up.

**Decision: one CodeMirror instance whose document is a projection of the
block's bytes.** A row is its hex and its characters on the same line, so the two
views are aligned by construction rather than by synchronising two scrollers, and
"a change in one shows in the other" is not sync logic but a single transaction
carrying two ranges — which also means undo reverses both together, because they
were never separate.

What this buys, all of it otherwise hand-written: row virtualisation for a block
up to the 48 KB practical ceiling, caret and cursor motion, focus, scrolling,
touch, accessibility, and the address gutter (CodeMirror's own line-number
gutter with `formatNumber` rendering `formatWord`, so the legend reads `$4000`,
`$4010` — machine addresses, not file offsets).

The cost is an invariant: the document is derived from the bytes and must be
reprojected whenever they change from elsewhere. That invariant is not new —
`AsmEditor` maintains the same one between assembly text and bytes, and the
baseline spec already requires the re-seed be non-undoable.

### The view mode is part of the projection

Hex and characters side by side needs room. Where there is none, they become
tabs.

**Decision: the projection takes a mode — hex, characters, or both — and a
bytes-per-row, and the surface changes view by reprojecting.** Switching tabs and
narrowing the row are then the same operation, not two mechanisms: rebuild the
document, restore the caret's byte. The mode is chosen at the app's existing
narrow breakpoint (`MOBILE_QUERY` plus the landscape query in
`src/app/useMediaQuery.ts`), the same expression `Workspace` uses to decide its
own tabbed layout; the selected tab lives in the store, as selection does
elsewhere.

Bytes-per-row still steps with available width independently of the mode — a
phone showing only the hex view still cannot fit sixteen pairs.

The projection and its inverse — document offset to byte index and back — are a
pure module, tested there and not through the component. It is the piece
everything else depends on being right.

Its addressable range is the block's bytes *plus one*: a block grows by the caret
resting one position past the last byte and a value being entered there, so the
mapping has to name that position and the caret has to be allowed to sit on it.
That is the only place the projection reaches outside the array it is projecting.

### Overwrite in the middle; the end of the block is editable

Insert and delete *in a block's interior* would shift every byte after the caret,
silently invalidating any BASIC that calls into the block and any absolute
reference inside it. Classic hex editors are overwrite for the same reason. The
assembly editor shifts bytes freely when a line is inserted, but only because the
assembler recomputes every label and reference behind it; a byte editor has no
symbolic layer to fix anything up. That argument is about the middle of a block,
and it holds.

It says nothing about a block's *length*, and an earlier draft of this design
wrongly extended it there — deciding that typing never changes the length, and
that growing and shrinking is a separate named action whose shrink half asks
first. Two facts about the tree say otherwise:

- A block has no length. `MemoryBlock` carries `bytes`, and the extent is derived
  wherever it is needed — `blockRange` in `src/app/blockLint.ts` computes
  `address + bytes.length - 1`, and treats a zero-length block as occupying
  nothing.
- The assembly editor already resizes blocks continuously and silently.
  `AsmEditor.runAssemble` replaces the whole `Uint8Array` with whatever the
  assembler emitted on each clean debounce, so adding an instruction grows the
  block and deleting one shrinks it, with no gesture and no confirmation. The
  byte editor would have been the stricter of two surfaces over the same data
  model, for no reason its sibling honours.

**Decision: a length change is an edit like any other, made in the document.**
Entering a value past the last byte appends; deleting the last byte truncates.
Neither moves a byte that is already there, so the interior rule above is intact.
For a change too large to type, the byte count in the status strip is editable —
grow pads with `$00`, shrink truncates — which is a field, not a modal ritual.
Length is clamped to `0x10000 - address`; zero is legal.

Routing length through the document, rather than around it, is what removes the
confirmation. Everything that changes bytes *outside* the caret has to reproject,
and a reprojection is deliberately guarded out of the undo history (below) — so a
resize done as an out-of-band action could not have been undone, and the shrink
confirmation was compensating for that. An append or a truncation dispatched as
an ordinary transaction is undone by the same `history()` that undoes a nibble.
The assembly editor's equivalent — deleting a line of source — is not confirmed
either, and for the same reason.

The one thing this gives up is that a block can now be grown into a neighbour or
into the program area from the byte editor. That is not new: the assembly editor
has always been able to do it, and `lintBlocks` refuses the run and names the
overlap. Length is checked when it matters, which is at Run.

### The character view goes through the machine's charset

Every dialect exposes `CharsetMapping.glyph(code)` (total over `0x00`–`0xFF`)
and `toMachine(text)`. A view that showed ASCII would be lying on most of these
machines, where `0x00`–`0x1F` are graphics and the letters sit at
machine-specific codes.

**Decision: render with `glyph`, encode typed characters with `toMachine`.** A
character the machine cannot represent is refused with a visible flash, not
silently substituted. Note that `toMachine` signals this by **throwing**
`CharsetError` — which carries the index of the offending character — rather
than returning a falsy value; the editing model catches `CharsetError`
specifically, rethrows anything else, and returns a refusal result, so the
component never handles an exception. `src/dialects/sourceUnits.ts` is the
reference for that catch.

Because the view is the machine's characters and not ASCII, it is labelled for
what it is — characters, not "ASCII", which would be wrong on most of these
machines.

### The on-screen keyboard is the one the editors already use

The retired plan specified a bespoke hex keypad, and called touch nibble entry
the least-tested interaction in the design.

**Decision: the byte editor takes input from `src/keyboard/VirtualKeyboard`
through the existing `KeyboardTarget` seam, and the hex view ignores any key that
is not a hex digit.** Those two halves fit together: the keyboard is a *machine*
keyboard driven by `dialect.keyboardLayout`, and in editor mode it emits letters
and digits as `EditorKeyAction` inserts. Filtering to `0`–`9`, `A`–`F` at the
receiving end is what makes a machine keyboard a usable hex keypad, with no
hex-specific layout data and nothing new per dialect.

Two pieces of plumbing follow from the surface being a CodeMirror instance rather
than a bespoke grid, and are the reason this is cheap: `editorInputRef` is
populated the way `CodeMirrorHost` already populates it, and `editorFocused`
follows from `update.view.hasFocus` instead of needing a new surface-agnostic
focus signal. `Workspace` does have to install the *right* surface's applier —
today the BASIC host stays mounted but hidden behind a block tab, so its applier
would otherwise receive keystrokes meant for the block.

`EditorKeyAction` should not need extending: inserts and arrows already exist,
and the surface interprets an insert as overwrite-mode nibble entry itself. The
house rule at `hideCaseKey` applies — machine-specific knowledge stays at the
call site, not in the keyboard.

### Editing rules are a pure model

**Decision: apply-nibble, apply-character, append, truncate, set-length and fill
live in a module with no React and no DOM**, in the shape of the existing
`src/app/blockEdit.ts`. The fiddly parts — high-then-low nibble sequencing,
auto-advance at the end of a byte, the append position past the last byte,
truncation to nothing, the `0x10000 - address` ceiling, charset round-tripping —
are exactly what a unit test can pin and a browser test cannot pin cheaply.

### Undo is the per-buffer history the editors already share

**Decision: byte-edit history is CodeMirror's `history()`, parked and restored
through `src/editor/bufferHistory.ts` under `blockBufferKey`, as the assembly
editor's is.** It is therefore per-block, and it survives showing another tab and
coming back.

An earlier draft decided the opposite — a bounded history in component state,
cleared on leaving the block — and justified it as matching how the assembly
editor behaves. That was wrong on the facts: `bufferHistory.ts` exists precisely
so a block's history outlives a tab switch, and the baseline `memory-blocks` spec
guarantees it in *A block's history outlives showing another tab*. Clearing the
history would have made the byte surface worse than its sibling for no reason.

Two disciplines come with the shared cache, both already modelled by `AsmEditor`:
a reseed guard, so re-projecting after an external byte change does not become an
undo step; and reconfiguring `Compartment`s on the live view, because a parked
state returns with the configuration it was put away with.

## Risks / Trade-offs

- **Where the caret may rest.** The document has regions that are not bytes — the
  spaces between hex pairs, the gap between the two views. Constraining the caret
  and the selection to byte boundaries is the real work in this design, and the
  reason drag-selection is out of scope for now. `atomicRanges` is the tool; the
  existing widget code is the worked example.
- **The projection must hold in both directions, forever.** Every operation that
  changes bytes from outside the caret — fill, a length set in the status strip,
  load-from-file, a commit echoing back through the store — must reproject and
  restore the caret. The
  mitigation is that the mapping is pure and tested, and that `AsmEditor` already
  runs the same discipline.
- **A block can now outgrow its address space from this surface.** Appending
  past a neighbouring block, or into the program area, is accepted here and
  refused at Run by `lintBlocks`, which names the overlap. That is exactly what
  the assembly editor already does, so it is a known shape rather than a new
  one — but a user who grows a block a long way will not hear about it until
  they press Run.
- **Switching text input off costs the device keyboard.** A surface that does not
  accept ordinary input does not raise the OS keyboard on a phone. That is
  consistent with taking input from the app's own on-screen keyboard, but it does
  mean the byte editor cannot fall back to the device keyboard, and it should be
  checked on a real phone rather than assumed.
- **Two editing surfaces for one data model.** Kept safe here only because their
  domains do not overlap: assembly for code blocks with an engine, bytes for
  everything else. If that ever overlaps, the authority question in the
  proposal's non-goals has to be answered first.

## Migration Plan

None. No stored shape changes: a block is already bytes, and the byte editor is a
second way to view and change them.

## Open Questions

- Should a block's kind be switchable *from* the byte editor, or stay in the
  Settings dialog only? Settings-only is the smaller change and the assumption
  here.
- Is there a case for a read-only byte view of a code block *alongside* its
  assembly — showing the bytes the assembler produced? Useful, cheap once the
  projection exists, and free of the authority problem because it is read-only.
  Worth deciding during implementation.
- Should the byte editor accept ordinary text input on a device with a physical
  keyboard, rejecting anything that is not a legal overwrite, rather than
  switching input off outright? That keeps the device keyboard and IME at the
  cost of a filter that has to be right about paste and drag-and-drop. Decide
  once the caret-placement work has shown how strict the surface needs to be.
