## Why

The machine picker is the one place a machine is chosen — starting a project,
switching the target of the program already open, and picking the two ends of a
port in the docs' porting guide. It presents every offered machine as an
illustrated row grouped under its manufacturer, and that single fixed
arrangement is the whole of its navigation.

With every machine the IDE supports in one dialog, that is now a scroll with no
way through it. A user who knows exactly which machine they want still has to
find it by eye, and a user who does not know cannot ask the list the questions
they actually have: what is the oldest of these, what is this called
alphabetically, which of these run the same BASIC. The last of those is the
porter's question, and it is the one the current grouping answers least well —
machines that run the same BASIC are scattered across four manufacturers.

## What Changes

- **The machine list can be searched.** A text field narrows the list to
  machines whose name, manufacturer, or BASIC dialect contains what was typed,
  case-insensitively. A search that matches nothing says so and offers a way
  back to the full list.
- **The machine list can be arranged four ways**, chosen from a control beside
  the search field:
  - **Manufacturer** — grouped under the maker, as today, and still the default.
  - **Model** — one ungrouped list.
  - **Year** — grouped under the release year, oldest at the top.
  - **BASIC dialect** — grouped under the BASIC the machine runs.
- **The machines inside a group read predictably.** In every arrangement but
  Year they are ordered by name, with model numbers ordered numerically so that
  a 664 comes before a 6128. Year is ordered chronologically, oldest first.
  **BREAKING** for the Manufacturer arrangement, which today orders each maker's
  machines oldest-first: the C64 now precedes the PET.
- **No heading appears without machines under it.** Only years that hold a
  machine get a year heading; the same holds for every other arrangement, and
  for a list narrowed by a search.
- **The search text and the arrangement are remembered** across sessions, so the
  picker reopens as the user left it, and the two IDE pickers (the toolbar's
  target control and the New-project dialog) agree on both.
- **Every machine declares the BASIC it runs**, as a fact about the machine
  rather than a phrase inside its one-line description. The porting guide
  already states this per machine and pins it to that description; it becomes
  the machine's own, and the guide reads it from there.
- The docs' porting guide renders the same picker, so it gains the search and
  the arrangements too. It does not remember them between visits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-setup`: "Machines are described well enough to choose between"
  currently requires the list to be grouped by manufacturer, full stop. It
  becomes: manufacturer is the default arrangement, the list may be searched,
  the user may choose among a fixed set of arrangements, each arrangement's
  order is stated, empty headings never appear, and a search matching nothing is
  reported with a way back.
- `persistence`: "Settings persist locally" names the preferences that survive a
  reload. The picker's search text and chosen arrangement join them.
- `dialect-toolchain`: "Registered dialects are the available targets" requires
  the same machine list to be presented wherever a machine is chosen. That
  guarantee now has to cover the search and the arrangement as well as the
  descriptions.

## Impact

- The `Dialect` seam gains a `basicDialect` field, declared by every registered
  dialect. Nothing is asked of a `MachineEmulator`.
- The porting guide's per-machine BASIC name stops being a fact of its own and
  becomes a read of the seam, so the guide and the picker cannot disagree by
  construction rather than by a crosscheck over prose.
- The machine picker's pure decision layer, the dialog that renders it, the two
  IDE hosts, the ROM-replacement machine list in Settings (which reuses the
  picker's grouping), the local settings store, and the docs host and its
  stylesheet.
- No emulator, tokenizer, charset or file format is touched, and which machines
  are offered is unchanged.

## Non-goals

- **Changing which machines are offered.** The ROM-presence filter that decides
  what the picker may list is untouched.
- **Fuzzy or ranked search.** Plain case-insensitive substring, in a fixed
  field set. No relevance ordering, no typo tolerance, no search over the
  machine's description text.
- **A sort direction control.** Each arrangement has one order.
- **Favourites or a recently-used arrangement.** The remembered state is the
  search text and the arrangement, nothing else.
- **Remembering the search and arrangement in the docs' porting guide.** It
  renders the same picker but persists nothing.
- **Restating the BASIC name in each machine's description.** The description
  still names the BASIC, as the reader sees it; the new field is what the
  product sorts and searches on.
