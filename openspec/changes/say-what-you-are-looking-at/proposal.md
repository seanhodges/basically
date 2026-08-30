## Why

A block's editor stacks its chrome. Above the bytes sit the tab strip, then a
status strip, then — on a phone, where rows are scarcest — a second strip of
Hex and Text tabs, and then a fill row when it is open. Four rows of furniture
above a surface whose whole subject is sixteen bytes to a line.

The status strip is written three times over, once per surface, each with its
own paddings and font size, and each opening with the block's name — which the
tab immediately above it already shows, in bold, as the reason that tab is
selected. The one fact the reader has to look up twice is the one thing the
strip repeats.

What the strip does say is thinner than it looks. `ORG $8000` names where a
block begins and leaves the reader to add the byte count in their head to find
where it ends. On a surface about a range of addresses, the range is the one
thing not shown — and it is what the user actually needs, because it is what
decides whether the block collides with the machine, with BASIC, or with
another block.

Meanwhile two things that are not status at all sit in the strip. `Fill…`
unfolds a fifth row, and an editable byte count offers a block's size in the
one place its address is *not* offered: the address lives in the block's
settings, the size lives in the strip, and the two are bounded by each other.
And for a saved data file, a sentence of the strip is spent saying the view is
read-only — while the editor separately answers each attempted keystroke with a
message that flashes for two and a half seconds and then leaves nothing behind.

And the case for dropping the name from the bar rests entirely on the tab
above, which is thinner still. The program's own tab carries no mark at all.
The other four kinds carry one character each — a gear for an assembly block,
which is the same gear the toolbar uses for **Open settings**; a shaded square
for a binary block; a pencil for a scratch buffer; a floppy disk for a saved
file, an emoji that renders differently on every platform and not at all on
some. The menu that creates three of those kinds shows no mark whatsoever, so
what the user picks and what they get have nothing in common to look at. A tab
worth leaning on has to say which of five things it opens; these five say it
by accident, in whatever the font happens to have.

## What Changes

- **One bar, shared by both editors.** The assembly editor and the byte editor
  render the same bar instead of two near-duplicate strips that disagree about
  their own height and font size.
- **The bar names the addresses the block occupies**: `$8000 - $80AD`, not
  `ORG $8000`. A block holding no bytes occupies nothing, so it shows its
  address alone.
- **The block's name leaves the bar.** Its tab carries it, one row above.
- **The entry address and comment appear in both editors**, not just the
  assembly one — the same facts about a block wherever it is opened.
- **The Hex/Text choice moves into the bar** rather than sitting in a strip of
  its own beneath it. That choice only exists where both views cannot fit —
  a phone, a short landscape window — which is exactly where a whole extra row
  is worth the most.
- **A block's size moves to its settings**, beside the address it is bounded
  by, and is applied on Save like every other setting. Growing a block by
  typing past its last byte, and shrinking it with Backspace, are unchanged and
  stay undoable in the editor. Only the typed byte count moves, and with it the
  fact that setting a size outright is now confirmed by Save rather than being
  an edit undo reaches.
- **Every kind of tab wears its own mark**, drawn in the same line art as the
  rest of the IDE: the program, a scratch buffer, an assembly block, a binary
  block and a file the running program saved are five kinds, and become five
  marks. The program's tab gains one for the first time.
- **The marks say what the tab holds** rather than borrowing a symbol that
  already means something else. Nothing in the set repeats the meaning of the
  gear, the memory chip, the floppy or the editor's own `</>`.
- **The menu that creates a tab shows the mark that tab will wear**, and so
  does the list of tabs the strip has no room for, so the same kind reads the
  same way wherever it is offered.
- **A saved data file is marked read-only, permanently, rather than told so on
  each keystroke.** A red `RO` at the end of the bar replaces the sentence, and
  typing into the file simply does nothing. The refusals that really are events
  — a character the machine's charset has no code for, a byte a Sinclair
  listing cannot hold — are untouched and still visible.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `memory-blocks`: one requirement added — *A block's editor says where the
  block sits* — covering what the bar states (the address range, the size, the
  entry point, the comment), what it does not repeat (the name), and that the
  choice between the two byte views belongs in it. The existing *Blocks are
  editable as bytes* requirement is modified in one paragraph: a length set
  outright is set in the block's settings rather than typed into the editor's
  own strip; length changes made by editing the end of the block are unchanged
  and stay undoable.
- `code-editor`: one requirement added — *A tab says what kind of editor it
  opens* — covering that every tab carries a mark, that the five kinds are
  five distinct marks, that a tab offered anywhere else wears the same one, and
  that the mark identifies the tab without becoming its name. And
  *Saved data files appear as tabs* is modified so that the
  read-only state is marked for as long as the tab is open, and an attempted
  edit does nothing rather than reporting a refusal. Its existing wording —
  "it is clear the view is read-only" — is satisfied by either behaviour, which
  is precisely why the change is written down instead of being smuggled in
  under it.

`persistence` is **not** affected. Nothing stored changes shape: a block's size
is, and remains, the length of its bytes, so autosave, the project bundle and
share links carry exactly what they carry today.

`control-labelling` is **not** affected. The bar's one new piece of text is a
marker rather than a control, and the controls that move keep the names they
already announce.

`dialect-toolchain` and the `Dialect` seam are **not** affected. This change
adds no field to any machine's contract; every fact the bar shows is one the
components already hold.

## Non-goals

- **Moving `Fill…` into the settings dialog.** Filling a range is an edit to
  the bytes, not a property of the block. It belongs where the bytes are, next
  to undo, and it stays in the bar.
- **Selecting a range of bytes by dragging to fill it.** The caret addresses
  one byte; a fill names its range. That was settled when the byte editor was
  built and is not reopened here.
- **An editable length for an assembly block.** The assembler decides how many
  bytes the source produces. The settings dialog states that size for such a
  block; it does not offer to overrule it.
- **Changing the two-views-of-one-document model, or the width at which they
  become a choice.** The projection, the breakpoint and the shared undo history
  are exactly as they are. Only where the choice is *presented* changes.
- **Removing the refusal channel.** Two refusals are genuine events and stay
  visible. What goes is the one that reports an unchanging state.
- **Restyling the tab strip beyond its marks, or touching the toolbar or the
  RAM budget bar.** Tab order, the rule that decides which tabs fit, and the
  overflow control are all exactly as they are.
- **Changing which kinds of tab can be created.** A saved data file is written
  by the running program and the program's tab is never created at all, so
  three of the five kinds appear in the creation menu, as today.
- **Putting the kind into a tab's name for assistive technology.** A tab is
  announced by its name; what kind it is stays where it already is, on hover.

## Impact

Affected code (confirm against the tree when implementing):

- Five new icons in the IDE's shared icon set, and one mapping from a tab's
  kind to its icon in `src/components/EditorTabBar.tsx` — replacing the two
  copies of each glyph literal that live there now, one in the strip and one in
  the model the overflow menu reads. The creation menu's items lead with the
  same icons; the CSS rule those menu items already carry was written with a
  glyph in mind and needs no change. `src/components/EditorTabBar.module.css`
  needs the kind mark laid out for an inline SVG rather than a character.
- Tab widths shift a little, since an icon is wider than the character it
  replaces, so marginally fewer tabs fit before the strip overflows. The fit is
  measured from the rendered tabs rather than computed, so nothing breaks; it
  is a thing to look at, not to fix.
- A new shared bar component, replacing the status strips in
  `src/components/AsmEditor.tsx` and `src/components/ByteEditor.tsx` and their
  two disagreeing `.statusStrip` rules. `src/components/UnsupportedBlockNotice.tsx`
  renders the same facts as prose rather than as a bar and is left alone.
- `src/components/ByteEditor.tsx` loses its length field and its commit
  handler, and its Hex/Text strip becomes part of the bar. Its read-only branch
  stops flashing a refusal; the refusal channel itself, and the two refusals
  that use it, stay.
- `src/components/BlockSettingsDialog.tsx` and the draft model in
  `src/app/blockEdit.ts` gain a size field, validated against the block's
  address and applied through the existing pure `setLength` in
  `src/app/byteEdit.ts` — which already clamps, pads with zero and truncates,
  and needs no change.
- The address range is `formatWord` from `src/asm/format.ts` over an expression
  the fill row already computes for its own hint. Nothing new is derived.
- Several e2e specs match a tab strip's text with regular expressions
  *because* a glyph prefixes each tab's name; an icon contributes no text, so
  those can tighten to exact strings.
- e2e specs assert the strip's text directly — the literal `ORG $8000` and the
  byte-count field's test id in `e2e/memory-blocks/`, and the read-only refusal
  in `e2e/persistence/saved-data-tabs.spec.ts`. Those assertions move with the
  controls; no new cold page load is added for them.
- `docs/guide/machine-code.md` (the byte count in the strip, and the settings
  menu item, which now sets size) and `docs/guide/testing-programs.md` (the
  read-only file now has a marker to name).

No dependency changes.
