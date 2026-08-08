## Context

The porting guide already draws two machines' memory layouts in a VitePress page,
using the IDE's own `MemoryMapView` mounted as a React island. The hardware
reference pages are ordinary Markdown in the same site, so the machinery this
change needs exists; what it does not have is a single-machine form of it.

`docs/contributing/architecture.md` describes the docs/app seam and the drawer
that hosts the documentation inside the IDE. Two properties of the existing code
decide most of this design:

- **The pair component's shared settings are pair-specific.** One zoom, one
  scroll offset and one notation across both panes, plus `proportional` band
  layout, are what make two maps a comparison. On a page showing one machine's
  layout — or three machines' layouts that are not being compared — every one of
  those is wrong: `proportional` clamps nothing, so a small region is a sliver,
  and a shared scroll offset would drag unrelated maps around together.
- **The documentation bundle must not reach `src/dialects/registry.ts` or
  `src/emulator/**`.** `src/components/machinePickerBoundary.test.ts` enforces
  this by resolving imports itself, so a violation names the module that crossed
  the line.

## Goals / Non-Goals

**Goals:**

- A hardware page shows the *same* memory map the IDE and the porting guide show,
  not a third rendering of the same data.
- Each map on a page is read on its own: its zoom, notation, detail and selection
  belong to it and to no other map on the page.
- A page carries only its own machines' data, so a reader who opens the ZX81's
  hardware page does not download the C64's map.
- React stays off every page that does not draw a map.

**Non-Goals:**

- Any change to the porting guide's pair, to the IDE's panel, or to the maps.
- Comparison between the maps on a multi-machine page — that is the porting
  guide's job, and the pages link to it already.

## Decisions

### A sibling component rather than a mode on the pair

`MemoryMapPair.vue`/`.tsx` could take a "single" mode, but almost none of it
would survive: the tab strip, the active-pane tracking, the hidden-pane scroll
re-application, the write-site hint and the shared-scale `proportional` flag are
all there to make two maps one picture. What the two forms genuinely share is the
React-island mounting (two dynamic hops, `ResizeObserver` + `zoomToFit`, pushing
Vue state into the React root) and the control strip — the first is a pattern
worth repeating, being twenty lines of lifecycle, and the second is CSS, which is
extracted to a stylesheet both import rather than duplicated.

The single component therefore omits `proportional`, taking the view's default:
a region too small to read is clamped to a legible minimum and the bands are
gapped. That is the right default when nothing is being aligned against anything.

### The page passes the map; the component resolves everything else

Each hardware page imports only its own machines' `memoryMap` modules, so a page
pulls one map (or two, or three) rather than all thirteen. Everything else the
view needs is derived from the machine id: the display name from
`src/reference/machines.ts`, and the address notation and the `?addr`-versus-`PEEK`
read-back from `src/reference/facts.ts`. Both are already pinned to the dialect
registry by their crosscheck tests, so a page never repeats a per-machine
constant that could drift.

`writesByIndirection` — the test that a machine writes memory with `?addr=` rather
than `POKE` — is currently inline in `DialectCompare.vue`. It moves to a shared
module so the two components ask the same question of the same field.

### The layout goes inside the existing `Memory` section

The hardware pages nest a fixed set of H3s under a per-machine H2, and the
reference-docs convention is that the layout is fixed. The map goes at the top of
the existing `### Memory` section rather than under a new heading, which keeps
that convention and puts the picture immediately above the prose that quotes
addresses out of it.

### The wiring is pinned by discovery, not by a list

`src/reference/hardware-memory-map.test.ts` walks the machine list, discovers on
disk which machines have a `memoryMap` module, and asserts that each one's
hardware page embeds its map — and that a machine without a module has no map on
its page. A dialect added later fails the test until it is wired, which is the
same property `machinePickerBoundary.test.ts` and `src/dialects/memoryMap.test.ts`
are built around.

## Risks / Trade-offs

- **Three maps on one page is three React islands.** The Commodore page mounts
  three `MemoryMapView`s. They are small, and the React chunk is shared between
  them, but the page pays three fit-to-pane measurements on load. Accepted: the
  alternative — one map behind a machine switcher — hides two thirds of the page's
  subject behind a control, on a page whose whole structure is one section per
  machine.
- **The maps are client-only.** `<ClientOnly>` means the layouts are absent from
  the pre-rendered HTML, so they do not appear in the site's search index or in a
  printed page. The pair has the same property, and the prose in each memory
  section — which is indexed — still carries the addresses a search would look
  for.

## Migration Plan

None. Nothing is removed, no data shape changes, and every page keeps working
with the map absent.

## Open Questions

None.
