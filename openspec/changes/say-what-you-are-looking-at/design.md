## Context

Three surfaces render a block today: the assembly editor, the byte editor, and
the notice shown for a code block on a machine with no assembler. Each opens
with its own hand-rolled status strip, and the two editors' strips have drifted
apart — one 13px and wrapping, the other 12px and ellipsising — for no reason
other than being written at different times.

The tab strip the bar defers to is in a similar state. Four of the five kinds
of tab are marked by a single character chosen for being roughly the right
shape, one of them a gear that means "settings" three inches away in the
toolbar and one an emoji with no reliable glyph on Linux; the fifth, the
program itself, is marked by nothing. Each character is written twice — once
where the strip draws the tab, once in the model the overflow menu reads — and
the menu that creates three of these kinds shows none of them.

Everything this change shows is already in the components' hands: the byte
editor computes a block's last address for the fill row's own hint, and both
editors hold the address, the bytes, the entry point and the comment. Nothing
new is derived from the machine, and nothing new is stored.

See `docs/contributing/architecture.md` for the store conventions and the
component layout; this change alters neither.

**Dialect/MachineEmulator seam: no impact.** The bar is presentation over a
`Block` the components already receive. No dialect declares anything new, no
`MachineEmulator` method is called, and the byte editor's one dialect-facing
dependency — the charset it encodes characters through — is untouched.

## Goals / Non-Goals

**Goals**

- One bar, one implementation, one set of rules for its height and spacing.
- The bar answers the question the surface is about: which addresses does this
  block occupy?
- A phone spends one row on chrome between the tab and the bytes, not two.
- A block's size and its address are set in the same place, because each
  bounds the other.
- Read-only is stated continuously, because it is continuously true.
- A tab says which of five things it opens, and says it the same way wherever
  that tab is offered.

**Non-Goals**

- Changing the byte projection, the mobile breakpoint, or the fill affordance
  (see the proposal's non-goals).

## Decisions

### One shared bar component, not two strips that resemble each other

The alternative is to leave the two strips in place and edit each — three
copies of the same five facts, which is how they drifted apart in the first
place. The bar is also about to grow a conditional (a range or a bare address,
an entry point or none, a read-only mark or not); duplicating that conditional
is duplicating the part most likely to be got wrong in one copy only.

**Decision: a single bar component, taking the block's facts and a slot for the
controls that belong to the surface.** The assembly editor passes no controls;
the byte editor passes its `Fill…` button and, where the views cannot both fit,
the Hex/Text choice. The refusal message is the bar's, since both surfaces
could raise one and only one does today. The shared styling settles on the byte
editor's — 13px, wrapping, sized to match the tab strip immediately above it,
so the whole stack of touch targets stays consistent.

`UnsupportedBlockNotice` keeps its own text. It is a paragraph explaining why
there is nothing to edit, not a bar above an editor, and it *should* name the
block because there is no editor below it to give the name context.

### The range replaces `ORG`, and the byte count stays

The range makes the count redundant arithmetically: `$8000 - $80AD` is 174
bytes, for a reader willing to subtract. But subtracting is exactly what the
old bar asked for in the other direction, and the count is the number a user
carries around — it is what the RAM budget is spent in, what a download weighs,
and what the machine's memory map is read against.

**Decision: show both — `$8000 - $80AD · 174 bytes`.** The range is the fact
the bar was missing; the count is the fact people quote.

Two cases fall out of this and must be handled rather than formatted around:

- **A block of no bytes occupies no range.** `$8000 - $7FFF` is worse than
  useless. Such a block shows its address alone, matching how the lint's own
  `blockRange` already treats an empty block as covering nothing.
- **A saved data file has no address at all** — its rows count offsets from the
  start of the file. It shows its size, and nothing about addresses.

### The Hex/Text choice folds into the bar

It could stay a strip of its own, which is tidy on paper: a tab list is a tab
list. But it only exists when the two views cannot both be shown — a phone, or
a short landscape window — which is precisely the situation in which a row of
chrome is most expensive. On a phone the editor was spending the tab strip, the
status strip and a tab strip for the views before showing a single byte.

**Decision: the choice sits at the end of the same bar**, pinned there and not
allowed to shrink, with the comment taking the ellipsis instead. The bar wraps
freely today; if the toggle were allowed to wrap onto a second line the change
would have moved a row rather than removed one, so the pinning is the point,
not a detail of the styling. It keeps its tab-list semantics and its two icons.

### Size becomes a setting; growing and shrinking in the editor stay

The baseline is explicit that a length change is an edit, undoable, "rather
than confirmed before it is made" — and that is worth keeping for the gesture
it was written about: typing one byte past the end, or backspacing the last
one. What it was stretched to cover is a typed byte count in the status strip,
which is not that gesture at all. It is a number the user thinks about, bounded
by the block's address, and the address is set two clicks away in the settings
dialog. Setting sixteen bytes to a kilobyte from a strip that cannot tell you
the ceiling, while the address that determines the ceiling lives elsewhere, is
the split this fixes.

**Decision: the typed size moves to the block's settings, beside the address,
and applies on Save.** Editing at the end of the block is unchanged and stays
undoable. The cost is honest and is written into the spec: a size set in
settings is confirmed by Save, not reversed by undo — the same bargain a move
already makes, and a move is the more destructive of the two.

The existing pure `setLength` does the work — clamp to what the machine can
hold at the address, pad with zero, truncate from the end — so the dialog gains
validation and a call, not a second implementation of the rule. Where a move
and a resize are saved together, the size is clamped against the **new**
address; anything else would validate against a block that is about to stop
existing.

### Size is stated, not offered, for an assembled block

The same dialog serves a block whose bytes come from assembly. There the
assembler decides the length: offering to set it would either be ignored or
would fight the next re-assembly.

**Decision: the field is read-only for an assembly-backed block**, exactly as
the address is already read-only for a block that lives inside a Sinclair
listing. One dialog, one more conditional, no second dialog to keep in step.

### Read-only is a state, so the bar states it

Today a saved data file spends a clause of the bar saying it is read-only *and*
answers every keystroke with a message that flashes for a couple of seconds and
then leaves nothing behind. That is the same fact told twice, once badly: a
transient message is the wrong shape for a condition that was true before the
user typed and will be true afterwards.

**Decision: a short, permanent mark at the end of the bar, and an attempted
edit does nothing.** Being an abbreviation, it carries the full phrase for
anything that reads the page aloud or on hover — two letters are a label for
the eye, not for a screen reader.

**The refusal channel stays.** Two refusals really are events, and the spec
requires them to be visible: a character the machine's charset has no code for,
and a byte a Sinclair listing cannot carry. Those keep the channel exactly as
it is. The third message that used it — the complaint about a byte count that
was not a number — leaves with the field it belonged to, into the dialog's own
validation, which is where every other bad value in that dialog is already
reported.

### The kind marks are a drawn family, not characters that were to hand

The present marks were picked from what a font happens to contain, and it
shows: they disagree on weight and size, two of them depend on the platform's
emoji coverage, and one is a gear the toolbar already uses for something else.
The rest of the IDE does not work this way — the toolbar, the mobile bar and
the byte editor's own view tabs all draw line art at a fixed size in the
current text colour.

**Decision: five drawn icons in the shared set, under the convention it already
enforces**, so a tab mark sits at the same weight as every other mark in the
app and looks the same on every machine.

The family is chosen by **what the data looks like**, not by object metaphor: a
numbered listing for the program, a pencil for a scratch buffer, rows of opcode
and operand for an assembly block, a grid of cells for a block of bytes, a
folded page for a file the machine wrote.

That is a rule with teeth, because it excludes the obvious choices. **No mark
in this family may repeat a meaning the app has already given away**: the gear
is Open settings, the memory chip is Show the memory map, the `</>` is the
editor pane, the floppy is the File menu, and the hash and the stacked rules
are the byte editor's own two views. An assembly block is therefore not a chip
and a saved file is not a floppy, however well either would read alone. This is
written down because the next person to add a tab kind will reach for the chip.

The one pair at real risk of reading alike at sixteen pixels is the program's
numbered listing and the assembly block's opcode rows, both being horizontal
rules. They are separated by the ticks and by the two-column rhythm; if that
does not survive the two being seen side by side, the opcode rows are redrawn.
The rule stands, the drawing gives way.

### One mapping from kind to mark

Each mark is currently written twice, in two places a hundred lines apart: the
strip's own JSX and the flat tab model the overflow menu renders from. They
agree today because someone kept them in step by hand, which is not a mechanism.

**Decision: one table keyed by the tab's kind, read by the strip, the overflow
menu and the creation menu alike.** That table is what makes "the menu shows
the mark the tab will wear" true by construction rather than by discipline, and
it is why the creation menu can gain marks without gaining a second opinion
about what they are. The pattern is the one the mobile tab bar already uses —
a table of kind, label and icon, rendered as an icon beside a name.

### The mark identifies; the name still names

A mark could be folded into what a tab announces to a screen reader — "machine
code block block1" — which sounds like more information and is not. It renames
every tab for exactly the users who cannot see the thing being described, and
the kind is already on hover, where it has been all along.

**Decision: the marks stay out of the accessible name.** A tab is announced by
its name, as it is today; the kind stays in the hover text. The marks are drawn
`aria-hidden`, which the shared icon convention does by default, so this
requires nothing but leaving it alone.

## Risks / Trade-offs

- **A size set in settings can discard bytes on Save, and undo will not bring
  them back** → the field states the ceiling for the block's address, in the
  same words the fill row's hint already uses, and shrinking is reported for
  what it is before the user saves. This is the deliberate cost of decision
  four; it is in the spec rather than hidden in the implementation.
- **Applying a size through the store reseeds the byte editor's document**,
  which may cost that block's editing history → establish what actually
  happens to the per-buffer history when the block comes back changed, and if
  the history is lost, say so where the size is set rather than letting the
  user discover it by pressing undo.
- **Pinning the view toggle in a wrapping bar is a layout claim, not a
  guarantee** → check it at a phone-portrait width, with a long comment
  present, since the comment is the element that will fight it for room.
- **An icon is wider than the character it replaces**, so every tab grows a few
  pixels and the strip fits marginally fewer before overflowing → the fit is
  measured from the tabs as rendered rather than computed from a glyph width,
  and the overflow unit tests supply their own widths, so nothing fails and
  nothing catches it either. It is checked by eye at a phone width, in the same
  pass as the bar.
- **The bar's text is what several e2e specs assert against**, including two
  that use `ORG $8000` as the only evidence that a block editor is on screen at
  all → those assertions move with the text they assert; the range is at least
  as specific a thing to match on.

## Migration Plan

None. No stored shape changes, and nothing about a saved project, a share link
or a block's bytes is different afterwards. A document saved before this change
opens identically after it.

## Open Questions

- Should a saved data file's bar show its offset range (`+0000 - +000C`) rather
  than only its size? Assumed **no** for now: an offset range restates the size
  in a less useful form, where a block's address range says something the size
  cannot. Worth revisiting only if a file's bar looks bare in practice.
- Does the byte editor's per-buffer undo history survive a size change made in
  settings? Assumed **not**, and treated as acceptable (a move has the same
  effect today), but it should be established rather than assumed while
  implementing — the answer decides whether the dialog needs to say anything.
