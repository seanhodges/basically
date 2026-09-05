## Why

The porting guide reports the two machines' memory layouts as two rows of the
language-and-hardware table — a screen base and a program start, four numbers in
total. That is the thinnest possible account of the difference that breaks
POKE-heavy programs most silently: a program whose writes were aimed at one
machine's system variables lands, unchanged and without error, in the middle of
another machine's BASIC program text.

The IDE already draws each machine's memory as a colour-coded, zoomable,
click-selectable map, and every machine's map covers the same 64K address space.
Two of them on one address axis turn those four numbers into a picture a reader
can act on, and — where the reader's own program is at hand — can say where that
program's writes land on each side.

## What Changes

- The comparison gains a memory-layout section showing the source and target
  machines' memory maps together on one shared address axis, with one set of
  controls (zoom, level of detail, address notation) governing both, so the two
  are always read at the same scale.
- Where the reader's own program is at hand, both maps mark the addresses that
  program writes to: on the source map as the program's own writes, on the
  target map as where those same addresses land on the machine being ported to.
- Where there is not enough width for two maps side by side, the pair becomes
  two tabs named for the two machines, holding zoom, detail, notation and
  scroll position across the flip so that flipping compares the same addresses.
- The section is absent for a pair either of whose machines has no described
  memory layout, rather than shown half-populated.
- **BREAKING** (for readers of the comparison, not for any API): the `Screen
  base` and `Program start` rows are removed from the language-and-hardware
  table. The maps supersede them, and keeping both would report one difference
  twice. No machine loses information: the only machine with neither fact is
  also the only machine with no memory map.

## Capabilities

### New Capabilities

None. The behaviour belongs to the existing porting-guidance capability.

### Modified Capabilities

- `porting-guidance`: gains requirements for reporting the two machines' memory
  layouts, for narrowing those layouts to the open program's writes, and for the
  tabbed fallback at narrow widths. Modifies **"The language and hardware
  differences are ordered by what the port turns on"**, which currently requires
  the memory addresses to be reported adjacently within the memory run of the
  fact table — a guarantee the removed rows can no longer carry, and which the
  memory-layout section now provides instead.

`memory-map` is deliberately **not** modified. Its requirements — that a map
accounts for the whole address space, that zooming reveals the machine's own
subdivisions losslessly, that regions are named as the machine's documentation
names them, and that colour means the same thing on every machine — are written
about the map itself, not about where it is shown, and hold unchanged in the
guide. Its requirement that a machine without a described layout is not offered
a map is what the new "absent for an undescribed machine" behaviour follows
from.

## Non-goals

- **No live memory activity in the guide.** The read/write overlay needs a
  running emulator; the comparison must work with no emulator, no API key and no
  network, and is read outside the IDE as often as inside it.
- **No linked selection between the panes.** Selecting a region on one side
  highlighting whatever covers the same addresses on the other is a natural next
  step, but it is a separate piece of behaviour and is not part of this change.
- **No new memory-map data, and no change to any machine's map.** This change
  shows the maps that exist; it does not deepen them, and it does not add one
  for the machine that has none.
- **No change to what the assistant is handed** when it carries out a port. The
  port report already describes the machines without these addresses.
- **No change to the porting facts themselves.** The screen base and program
  start remain recorded per machine and remain pinned to each machine's real
  memory map; only the two table rows in the comparison go.

## Impact

- **Porting guide** (`docs/.vitepress/theme/components/DialectCompare.vue`, plus
  a new pair component beside it, and `docs/reference/compare.md`): the new
  section, its place in the page's section list, and the removal of two fact
  rows.
- **Memory map component** (`src/components/MemoryMapPanel.tsx`): split into a
  presentational view the guide and the IDE both render, and an IDE wrapper that
  keeps the store wiring, the program analysis and the activity overlay. The
  IDE's own panel is expected to behave identically; `e2e/memory-map/` is the
  regression gate.
- **IDE↔guide message boundary** (`src/components/DocsDrawer.tsx`,
  `src/app/programVocabulary.ts`): the program-vocabulary reply gains the
  program's write sites. Additive and defaulted, as every field of that payload
  is, so a cached older app answering without it degrades to layouts-only.
- **The docs/app import boundary** (`src/components/machinePickerBoundary.test.ts`):
  the documentation bundle comes to import each machine's memory map. One
  address constant currently reached through an emulator module has to move to
  the dialect that owns it so the boundary — no dialect registry, no emulator
  core, in the docs bundle — continues to hold.
- **Dialect / MachineEmulator seam**: unaffected. No new field on `Dialect`, no
  new method on `MachineEmulator`; the change reads `Dialect.memoryMap`, which
  already exists.
- **User docs**: `docs/reference/memory-management.md` gains a pointer to the
  side-by-side view.
