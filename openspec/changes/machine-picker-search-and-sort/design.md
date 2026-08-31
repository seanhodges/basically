## Context

The machine picker is one controlled, store-free, registry-free React component
with its decisions extracted into a plain module beside it, rendered by three
hosts: the toolbar's target control, the New-project dialog, and the docs'
porting guide. An import-graph guard holds that boundary — the docs bundle must
never reach the dialect registry, because the registry imports every dialect
index and each pulls in an emulator core. Every design choice below is shaped by
that: the new logic goes in the pure module, the new state is a prop, and
persistence stays in the host that has a settings store.

See `docs/contributing/architecture.md` for the store, seam and component
conventions this follows.

## Goals / Non-Goals

**Goals:**

- Make the machine list navigable by typing and by four arrangements, without
  giving the picker a second personality per host.
- Give the product a first-class per-machine BASIC name, so arranging and
  searching by it reads data rather than parses prose.
- Keep the two IDE pickers agreeing on the narrowing and the arrangement, which
  the `dialect-toolchain` guarantee already implies for the list itself.
- Leave every existing hook the e2e suite drives on the dialog intact.

**Non-Goals:**

- Ranking, fuzzy matching, or searching the machine description text.
- Persisting anything in the docs host.
- Re-ordering the reference sidebar or the docs machine list, whose file order
  is its own concern.

## Impact on the Dialect / MachineEmulator seam

**The `Dialect` interface gains one field: `basicDialect`, the name of the BASIC
that machine runs, as the machine's own documentation names it.** Nothing is
asked of a `MachineEmulator`, no method changes, and no behaviour is conditioned
on a machine's identity — the arrangements read declared fields and group by
what they find, so a machine registered later is arranged and searched without
being enumerated anywhere.

The field is not new information. The porting guide already states it per
machine, and a crosscheck already pins it to a substring of the machine's
one-line description. This change moves it to the machine and turns the
crosscheck around.

## Decisions

**The BASIC name goes on the seam rather than being read from the porting
guide's facts.** The guide's fact table would have served — it is structured,
complete, and already crosschecked — but it is a large hand-authored data module
that the IDE does not otherwise import, and pulling it into the app bundle to
label a picker row is the wrong trade. It is also the wrong direction: which
BASIC a machine runs is a fact about the machine, like its manufacturer and its
year, and those live on the seam. Parsing it out of the description was the
third option and the worst: the convention that a description ends with the
BASIC's name is prose, enforced by nothing, and an arrangement that silently
regroups when someone rewords a sentence is not an arrangement.

Once the seam declares it, the crosscheck inverts. Today the guide's copy is
pinned to a _substring of the machine's description_; instead it is pinned to the
machine's own declaration, by equality, and a separate registry-driven test
asserts every machine's description names the BASIC that machine declares. Both
are strictly stronger than what they replace.

**The guide keeps its own copy of the name; the assistant's descriptions do
not.** The obvious follow-on - delete the field from the porting facts entirely -
does not survive contact with its readers. The comparison table's rows are a
list of accessors typed `(f: PortingFacts) => string`, so deleting the field
there means widening a pure-data accessor to carry one string it has no other
use for. And the porting facts are precisely the dataset that restates registry
facts on purpose, because the documentation runtime must never import the
registry - the machine list beside it restates the name, maker, year and
description on the same terms. So the field stays, restated and pinned, and the
guide is no worse off than it is for every other fact it holds.

The two places that compose a machine's description for the assistant are the
opposite case: both already hold the machine itself, and one of them looks the
facts up by id with a defensive branch for a machine that has no entry. Reading
the declaration makes that function total and deletes the branch. Their output
has to stay byte-identical for prompt prefix caching, which it does - the
strings are the same strings - and the inverted crosscheck is what now
guarantees it.

**Grouping and filtering stay pure functions in the picker's own module.** That
module is deliberately import-free so the guard has something clean to assert,
and it is where the existing grouping and labels already live. One entry point
takes the machines and the arrangement and returns groups; a heading of `null`
is the ungrouped arrangement, which is what lets the dialog render every
arrangement with one loop instead of branching on the mode.

Headings are derived from the machines in hand, never from a fixed list of
years, makers or BASICs. That is what makes "no empty heading" fall out rather
than being enforced: a year with no machine produces no key, and a search that
removes a group's last machine removes the group.

**Name ordering uses a numeric collator, built once.** Model numbers are the
reason: a plain string comparison puts CPC 6128 before CPC 664, because it
compares the second digit before it has any idea it is reading a number. A
collator with numeric ordering reads the digit run as a number and gets 464,
664, 6128. It is constructed at module level, not inside the sort callback,
because a collator per comparison is the expensive way to do this.

This changes the manufacturer arrangement's within-group order from oldest-first
to alphabetical, which is a visible change to today's behaviour, taken
deliberately: with four arrangements available, one of them is _the_ year
arrangement, and the other three answering "where is it in the alphabet" the
same way is what makes them predictable.

**The dialog stays fully controlled.** The narrowing text and the arrangement
become props with change callbacks, exactly as the selected machine already is.
The alternative — the dialog owning the state internally — would either give
each host its own memory (so the toolbar picker and the New-project picker
disagree) or force the dialog to reach for a store it must not import. Keeping
it controlled lets the IDE hold the pair in its store and the docs host hold it
in local state, with the component none the wiser.

**The IDE's copy lives in the store and writes through to local settings.** The
store is already where the picker's open state lives, for the same reason: two
hosts, one truth. Seeding it from settings at initialisation matches how the
installed-ROM map is seeded, and the setters write through so nothing has to
remember to save. The stored arrangement is validated on read against the known
arrangements and falls back to manufacturer, so a stale or hand-edited value
cannot produce a list with no order.

**Focus moves to the narrowing field when the list opens.** Today it lands on
the currently chosen machine, so the keyboard starts where the eye does. That
stops working the moment a remembered narrowing can hide the chosen machine —
there may be no row to focus. The field is the one element always present, and
it is where a keyboard user wants to start in a list they can type into. The
chosen machine is scrolled into view instead, when it survives the narrowing.

**A remembered narrowing that hides the current machine is dropped as the list
opens.** Persisting the text buys the case where you come back to the search you
were in the middle of; it also creates one where the list opens without your own
machine in it, or on the no-matches state - a list that cannot answer the
question you opened it to ask. Only the opening is corrected: text typed while
the list is up narrows as typed, because that is a deliberate act and clearing
it under the user would make the field unusable. The correction is applied
before the browser paints, so the narrowing it undoes is never shown.

The test is "offered but filtered out", not "absent from the list". A machine
the picker is not offering at all cannot be brought back by dropping the text,
and dropping it then would throw away a good search for nothing.

**Enter in the narrowing field does nothing.** In the New-project dialog the
picker deliberately renders inside the form whose submit creates the project, so
that dismissing the picker does not take the dialog down with it. Every button
in the picker already carries an explicit type for that reason; a text input
needs the same care, or typing a machine name and pressing Enter creates a
project. Escape keeps its existing meaning — it closes the list, it does not
clear the field — because the list is a modal first.

## Risks / Trade-offs

- **A remembered narrowing can make the picker look broken.** A user who
  searched for one machine last week opens the list and sees one machine. →
  The field shows the text that is doing it, uses the platform's search control
  so it carries a clear affordance, and the no-matches state says what matched
  nothing and offers the way back. This is the cost of the persistence the
  change was asked for, and it is paid in visibility.
- **The manufacturer arrangement reorders under existing users.** → It is stated
  in the proposal as a breaking change and pinned by a test, and the Settings
  ROM list that reuses the same grouping moves with it rather than diverging.
- **Two more controls inside a dialog rendered in documentation prose.** The
  docs host restates the app's element styles for the parts of the dialog that
  carry no class of their own, and a bare input and select in `.vp-doc` would
  otherwise inherit the site's form styling. → The host's stylesheet gains rules
  for them, and the docs build renders the guide, so a miss shows up there.
- **Arranging by BASIC produces many small groups.** Several BASICs are run by
  exactly one machine. → That is the honest answer to the question, and it is
  the arrangement the user chose; nothing is hidden and no group is invented.

## Migration Plan

Nothing to migrate. The new stored values are absent on first read and default
to no narrowing and the manufacturer arrangement, which is what the picker does
today. Removing the change would leave two unread keys in local storage.

## Open Questions

None.
