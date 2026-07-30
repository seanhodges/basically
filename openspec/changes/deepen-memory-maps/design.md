## Context

A dialect's memory map is a flat list of contiguous regions covering its address
space; the viewer collapses adjacent regions sharing a `group` into one band when
zoomed out and shows them individually when zoomed in. Depth is therefore purely
a data question - adding leaves under the right group changes the zoomed-in view
and leaves the zoomed-out view untouched. See `docs/contributing/architecture.md`
for where the map sits in the dialect seam.

Four machines never gained that depth. The ZX80, ZX81 and both CPCs describe
their whole 64K in five regions each, so zooming in shows nothing new.

## Goals / Non-Goals

**Goals:**

- Give the four coarse machines a zoomed-in view worth zooming into, without
  changing what any of them show zoomed out.
- Trace every new boundary to an in-repo constant or a cited primary source.
- Name regions the way each machine's own documentation names them, and record
  the sources in the code.
- Give the viewer a capability spec, and put its e2e specs in the matching folder.

**Non-Goals:**

- A TRS-80 map, colour changes, ROM bands on the CPC, splitting the CPC screen
  into CRTC interleave blocks, or naming the ZX80's undocumented workspace. All
  are covered in the proposal's Non-goals.

## Decisions

### Impact on the Dialect / MachineEmulator seam

**None.** No interface changes; this is data inside existing `memoryMap` values.
The viewer, `memoryBands`, the address scale and the activity overlay are all
generic over the region list and need no edit.

### Every new leaf carries the group its band already has

The zoomed-out view must not change, so each new leaf takes the `group` of the
band it sits inside, and the first leaf of a run keeps that band's existing
`kind` - a collapsed band takes its colour from its first leaf. This is what lets
a 5-leaf map become a 9-leaf map that still opens as four bands.

### Boundaries come from a source, and the source is named in the code

Each map's docblock gains a `Sources:` list. Where a boundary is already pinned
by an in-repo constant the constant is cited, not the manual - a reference to
`sysvars.ts` is checkable, a page number is not. The manual is cited for the
names, and for boundaries no constant pins.

Verifying the CPC's boundaries against the firmware manual corrected two things
this change was originally going to get wrong:

- `&0040-&016F` is **one** area, the "ROM lower foreground area / BASIC input
  area (tokenised)", `&130` bytes long. The plan had split it at `&0100`, which
  no source supports.
- The high kernel jumpblock is at **`&B900`**, not `&B100`. The main firmware
  jumpblock starts at `&BB00` and the machine stack sits immediately below
  `&C000`.

The CPC therefore gets 8 leaves rather than the 9 first sketched: fewer, but each
one traceable.

### The ZX80's unnamed workspace stays unnamed

`zx80/sysvars.ts` documents nothing above `DF_EA`, and records that its pointers
were confirmed by booting the real ROM. Under the naming rule that is a region
with no documented name, so it is labelled as workspace and its note says the
ZX80's documentation does not describe it. Inventing plausible names would be
worse than the coarse map it replaces.

### Two constraints inherited from tests, not chosen here

- **No `screen` region on the ZX80 or ZX81.** `facts-crosscheck.test.ts` ties the
  porting-comparison `screenBase` fact to the presence of a `screen` region, and
  both machines correctly have none - their display file lives inside program
  RAM and moves as the program grows.
- **The two CPC tables stay identical** in `[start, end, kind]`.
  `cpc6128/memoryMap.test.ts` pins them to each other so the pair cannot drift
  silently; only labels and notes differ, reflecting BASIC 1.1.

### The viewer gets its own capability

`memory-blocks` is about machine code blocks; its spec never mentions the map,
yet the map's three e2e specs live in its folder. Rather than widen that
capability, this adds `memory-map` and moves the specs.
`src/e2eCapabilityLayout.test.ts` mechanically verifies the folder↔capability
mirror, so the move is checked rather than hoped.

## Risks / Trade-offs

- **A new leaf silently changes the zoomed-out view** → each machine's own test
  asserts its band structure, and the shared cross-dialect test enforces that
  groups stay contiguous and unambiguous.
- **A cited source turns out not to say what the code claims** → boundaries
  already pinned by repo constants cite the constant instead, so the manual is
  load-bearing only where nothing else can be. Where two sources disagreed the
  manual's own wording was preferred and the disagreement is noted.
- **More leaves make the zoomed-in column taller** → it already scrolls; the
  minimum band height is unchanged, so this is longer, not broken.
- **Moving e2e specs loses history or coverage** → the move is a rename with no
  content change beyond the capability header comment, and the folder↔capability
  test fails if the mapping is wrong.
