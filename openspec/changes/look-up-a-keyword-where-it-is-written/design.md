## Context

See `proposal.md` for the motivation and `docs/contributing/architecture.md` for the
editor's place in the app.

Two facts shape the whole design:

- **The three docs openers already funnel through one resolver.** The toolbar button, the
  drawer handle and F1 each call the same contextual-topic function. Unhooking the
  selection is therefore one edit inside that function, not three.
- **The variable-usages feature already owns a good click-anchored menu**, but it is
  fused to the usages model. The assembly editor needs the menu and must not pull in the
  variable lexis, program outline and scanner modules for a feature it does not have.
  That forces a split regardless of taste.

**Seam impact: none.** The change reads the `Dialect`'s existing `keywords` and
`languageSupport()`, and the assembly engine's existing `cpu` and `mnemonics`. Nothing is
added to the `Dialect` / `MachineEmulator` interface, and no machine-specific code is
touched.

## Goals / Non-Goals

**Goals:**

- One gesture — click the token — answers every question the editor can answer about it.
- Keyword recognition follows the active machine, without a second implementation of
  what the highlighter already decides.
- The assembly editor gets the same menu without inheriting the usages machinery.
- Usages behaviour is byte-for-byte unchanged; its e2e journey guards the refactor.

**Non-Goals:**

- See `proposal.md` § Non-goals. In particular: no right-click menu, no change to the
  reference pages or their search, and no new baseline requirement for what the toolbar
  button opens.

## Decisions

### Read the token from the dialect's own syntax tree

Both editors are CodeMirror `StreamLanguage`s that already classify every token per
dialect. `@codemirror/language` names each node after the token-tag string the
tokenizer returns, so resolving a position yields `keyword`, `functionName`, `operator`,
`variableName`, `number`, `string`, `comment`, `labelName` directly — no mapping table.
Verified empirically against the installed package, including that a dialect-declared
multi-character operator (`<=`) arrives as a single node and that the tree is flat, so
resolution never lands on a wrapper.

**Alternative considered — a keyword scanner mirroring the variable scanner.** Rejected.
That module's entire job is to *reject* keywords so variables can be found, and it
mirrors the highlighter's rules by hand. Emitting keyword extents from it means
re-deriving, in a second place, crunch splitting, the whole-run keyword rule, `PROC`/`FN`
gluing, hex literals and string/comment blanking — plus operator tokenization, which it
does not do at all. `src/editor/dialectOperators.test.ts` exists precisely because that
operator logic was once duplicated and wrong in both directions; duplicating it again to
power a keyword lookup would re-commit the mistake that test was written to stop. The
scanner route also serves only the BASIC editor — the assembly tokenizer has no scanner
sibling, so it would need a second detector written from scratch.

**Resolve from both sides.** Resolving with a forward bias catches the left edge and the
interior; a backward bias catches the right edge. Taking the first that yields an
accepted node reproduces the usages lookup's existing "both edges count" behaviour, so
clicking either end of a keyword picks it. A click in whitespace yields the top node
from both sides and correctly offers nothing.

**Force the parse rather than trusting the viewport.** Measured on a ~79 KB document,
the lazily-built tree had reached only ~3 KB and a resolve near the end returned the top
node; a bounded ensure-parse completed the whole document inside a 50 ms budget. In a
live editor the viewport is normally parsed, but "normally" is not a guarantee after a
large paste or a fast scroll-then-click, and a silently missing menu row is the worst
failure mode here. Ensure the parse to the end of the clicked line with a small budget,
falling back to whatever tree exists.

### Skip the punctuation the highlighter styles as operators

Statement and argument punctuation is tagged as an operator on every dialect so it
colours consistently, but it earns no reference row. Offering **Reference** on a comma
would open the drawer onto an empty table.

The project has already named this exception: the reference crosscheck test guarantees
that every operator spelling *other than* that punctuation set has a row on every page.
So the row's skip-set must be the same set — that existing test is what makes the
operator offer safe at all.

One asymmetry to carry: the highlighter's punctuation set also contains the decimal
point, which the operator exception set does not (`10 PRINT .5` tags `.` as an operator).
Skip a single-character token drawn from the highlighter's set, and name the operator
exception set in the comment so the two are visibly related.

**Alternative considered — accept only tokens matching a `keywords` table entry.** Also
correct for punctuation, but it drops the alias spellings a dialect declares outside its
keyword table, which do have rows. The skip-set is the narrower, more honest filter.

### Split the menu mechanism out; do not rename the usages view

The usages view is roughly 40% reusable mechanism and 60% usages-specific state — the
field, the bar at the foot of the editor, the marks, the stepping. Renaming the whole
file to a neutral name would put the usages panel in a file named for a generic menu,
trading one lie for another. Extract the mechanism into its own module; leave the usages
view holding what is genuinely about usages and contributing one row.

The extracted module owns the tooltip state, the pointer handlers, the touch +
synthesised-mouse de-duplication, the invalidation rules (cleared on any edit, cleared
when find/replace claims the foot of the editor, withheld while the completion popup is
up) and the row rendering. Rows come from a list of sources, each asked whether it has
anything to offer at the picked position.

**A row source takes editor *state*, not a view.** Vitest runs in the `node` environment
and jsdom is not a dependency, so nothing in the suite mounts a live editor. Taking a
state keeps every row source testable with the same `EditorState.create` idiom the
highlighter tests already use, and only the DOM glue falls to e2e.

**Widen the de-duplication key to include the row labels.** Today it compares position
alone, which still works — keyword and variable rows are mutually exclusive by
construction, since the variable lookup rejects keywords. But that de-duplication is the
one piece of the file that degrades *silently* if it ever becomes wrong, and a
label-aware key costs a string concatenation.

### The menu claims Escape

Today Escape closes the usages *bar* only; an open offer is not keyboard-dismissible, and
in the assembly editor there is no bar at all, so Escape would fall through to whatever
surface stands behind the editor. `shell-navigation`'s dismissal requirement says a
surface's own use of Escape takes priority and the same keypress must not also dismiss
what is behind it — which argues the menu should claim it while open. New behaviour, so
it carries a scenario.

Verified safe in the assembly editor, which mounts neither completion nor search: both
guards read their fields optionally and degrade to "not active" when the extension is
absent. Worth a comment at the call site so nobody "fixes" it by adding the extensions.

### Inject the opener; keep the extension store-free

The Reference row takes a callback; the hosts close over the store's open-documentation
action. The extracted mechanism is the *generic* layer — the one the assembly editor also
mounts — and giving it a store dependency is the wrong direction. The topic cannot be
computed inside the extension anyway: the BASIC row needs the dialect and the assembly
row needs the block's processor, and both hosts already hold those and already use the
imperative store idiom in their update listeners.

### A named topic beats a pending porting comparison

The porting requirement's "by any means" predates any route that names a topic. The
Reference row names one, so it resolves its topic directly rather than through the
contextual resolver. Every opener that does not name a topic — the toolbar button, the
drawer handle, F1, the porting indication — still lands on the comparison. See the
`porting-guidance` delta.

### What the contextual resolver keeps

Only its tab-driven half. A machine-code block tab still opens the processor's page
unseeded, because that was context from the *tab*, not from the selection; a BASIC tab
yields nothing and the drawer opens at the docs home. This nuance is the one thing in the
change that is easy to lose by accident, so it gets its own unit test.

## Risks / Trade-offs

- **Punctuation offering a dead lookup** → the skip-set above, pinned by its own unit
  test. The decimal-point gap between the two exception sets is the easy thing to miss.
- **Lazy parsing hiding the row on a long document** → bounded ensure-parse, with a
  long-document unit test as the regression guard. Measured, real, and cheap to prevent.
- **A dialect that spells a two-character operator but does not declare it** → the
  highlighter splits it and the lookup seeds the first character, matching several rows
  instead of one. Not a regression (the selection route is going away), and the operator
  test already fails a dialect whose declared operators are not styled.
- **The refactor silently changing usages behaviour** → the existing usages e2e journey
  is untouched and guards it; the extraction lands as its own step so it is a clean
  bisect point.
- **Abbreviated spellings in a pasted listing** → the reference search matches short
  spellings, so a lookup on `P.` should still find its row. Worth a manual check on a
  Commodore listing rather than a test.
- **Mobile** → the editor gains a route that opens a full-screen drawer from a tap. The
  row suppresses focus theft and the drawer does not grab focus, so the virtual keyboard
  should be undisturbed; manual check, not worth an e2e.
- **Class renames spanning stylesheet, two e2e specs and the screenshot spec** → cheap
  but easy to half-finish; one task, done in one pass.

## Open Questions

None blocking. Two taste calls already settled with the user: the reference row's glyph
is `?` (a text glyph in the same register as the usages `⌕`, rather than an emoji beside
a monochrome neighbour), and the porting guarantee is narrowed rather than left
literally wrong.
