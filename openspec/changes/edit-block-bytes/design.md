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
  fixed geometry, overwrite, addresses that do not move.
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

### Overwrite only; resize is the explicit gesture

Insert and delete would shift every byte after the caret, silently invalidating
any BASIC that calls into the block and any absolute reference inside it. Classic
hex editors are overwrite for the same reason.

**Decision: typing never changes a block's length.** Growing and shrinking is a
separate, named action: grow pads with a fill byte, shrink asks first because it
discards data.

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

**Decision: apply-nibble, apply-character, resize and fill live in a module with
no React and no DOM**, in the shape of the existing `src/app/blockEdit.ts`. The
fiddly parts — high-then-low nibble sequencing, auto-advance at the end of a
byte, clamping at block bounds, charset round-tripping — are exactly what a unit
test can pin and a browser test cannot pin cheaply.

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
  changes bytes from outside the caret — fill, resize, load-from-file, a commit
  echoing back through the store — must reproject and restore the caret. The
  mitigation is that the mapping is pure and tested, and that `AsmEditor` already
  runs the same discipline.
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
