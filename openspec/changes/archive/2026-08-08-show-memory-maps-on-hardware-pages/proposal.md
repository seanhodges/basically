## Why

The porting guide reports two machines' memory layouts side by side, and the IDE
draws the active machine's layout in a panel next to the emulator. Between them
they cover the reader who is porting a program and the reader who is running one.
The reader who is neither — someone reading a machine's language reference to
find out what the machine is — gets neither.

That reader's page is the machine's hardware page, and its `Memory` section
currently answers a much narrower question: where a machine-code block may be
loaded. Where the screen actually is, how much of the address space the ROM
takes, what sits between the program area and the top of RAM — those are quoted
as a few addresses scattered through the prose, on the pages that mention them at
all. The layout the IDE already describes for every machine but one says all of
it, in one picture.

## What Changes

- Each machine's hardware reference page shows that machine's memory layout,
  within the section that already covers its memory, so the whole address space
  is read where the addresses are discussed.
- The layout is read with the same controls the IDE and the porting guide offer:
  zoom, level of detail, and whether addresses read as hexadecimal or as plain
  numbers. Each machine's layout is controlled on its own — a reference page
  covering several machines is several separate accounts, not a comparison.
- A page covering more than one machine shows one layout per machine, under that
  machine's own heading, because two machines sharing a BASIC do not share a
  memory map.
- A machine whose layout the IDE does not describe shows no layout on its
  hardware page, rather than a partial one.

## Capabilities

### Modified Capabilities

- `memory-map`: gains a requirement that every machine whose layout the IDE
  describes shows that layout in its own reference documentation, and that the
  layouts on a page are read independently of one another.

`porting-guidance` is **not** modified. The comparison's memory-layout section —
one shared address scale, one set of controls over both, narrowing to the open
program's writes — is a guarantee about comparing two machines, and is untouched
by showing one machine's layout somewhere else.

The existing `memory-map` requirements are also untouched. That a map accounts
for the whole address space, resolves losslessly as it is zoomed, names regions
as the machine's documentation names them, and colours a region by what it is
for, are written about the map itself rather than about where it is shown, and
hold as written on the new surface.

## Non-goals

- **No live memory activity.** The read/write overlay needs a running emulator;
  a reference page has none, and is read outside the IDE as often as inside it.
- **No marking of the reader's own program.** The porting guide narrows its maps
  to the open program's writes because it is answering a question about that
  program. A reference page is about the machine, and stays about the machine.
- **No new memory-map data, and no change to any machine's map.** This change
  shows the layouts that exist; it does not deepen them, and it does not invent
  one for the machine that has none.
- **No change to the porting guide**, to the IDE's own memory-map panel, or to
  the prose already in each page's memory section.
- **No new pages and no navigation changes.** The layouts land in sections that
  already exist; the documentation sidebar is untouched.

## Impact

- **Hardware reference pages** (`docs/reference/*/hardware.md`): each machine's
  memory section gains the layout. The page covering the machine with no
  described layout is unchanged.
- **Documentation theme** (`docs/.vitepress/theme/`): a single-machine sibling of
  the porting guide's pair component, registered the same way — the map is the
  IDE's own view, mounted as a React island behind two dynamic imports so React
  stays off every page that does not draw one.
- **The docs/app import boundary**
  (`src/components/machinePickerBoundary.test.ts`): the documentation bundle
  comes to reach the machine list and the porting facts through a component
  rather than only through a page, so both join the set the boundary walk holds
  to no dialect registry and no emulator core.
- **Dialect / MachineEmulator seam**: unaffected. Nothing is added to `Dialect`
  or `MachineEmulator`; this reads `memoryMap`, which already exists.
