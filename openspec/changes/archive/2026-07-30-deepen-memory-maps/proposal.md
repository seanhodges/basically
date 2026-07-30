## Why

The memory-map viewer lets the user zoom into a machine's address space to see
what each part is for, but four machines have nothing finer to reveal. The ZX80,
ZX81, CPC 464 and CPC 6128 each describe their whole 64K in five regions, against
the C64's fourteen and the BBC Micro's twelve. Zooming in on those machines shows
the same four bands the map opened with.

The coarseness also hides the things a user most needs to see. On the ZX81 the
whole `0x4000-0x407C` block reads "System variables", so nothing tells the user
that the printer buffer sits inside it, or that a `.P` file only saves the part
above `VERSN`. On the CPC the entire `0xAB80-0xBFFF` band is one label, so the
firmware jumpblock - the thing a machine-code program actually calls into - is
invisible.

Separately, the viewer has no requirement in any capability spec. It has a docs
page and three e2e specs living under `memory-blocks`, a capability whose stated
purpose is machine code blocks and which never mentions the map. There is nothing
recording what the map guarantees.

## What Changes

- **A new `memory-map` capability** records what the viewer guarantees: that a
  map accounts for its machine's whole address space, that it resolves into finer
  regions as the user zooms in, and that regions are named as the machine's own
  documentation names them.
- **The four coarse maps gain sub-regions**, each boundary traced to an in-repo
  constant or a cited primary source. The ZX81 goes from 5 leaves to 9, the ZX80
  to 8, and the two CPCs to 8 - while every one of them keeps exactly the bands it
  shows today when zoomed out.
- **Region labels are audited against each machine's own documentation** and every
  `memoryMap.ts` gains a `Sources:` list naming the works its layout and
  vocabulary came from. Where an area has no documented name - the ZX80's
  workspace above `DF_EA` - the map says so rather than inventing one.
- **The three memory-map e2e specs move** from `e2e/memory-blocks/` to
  `e2e/memory-map/`, and a new spec covers zooming into the four newly-deep
  machines, which no e2e touches today.

## Capabilities

### New Capabilities

- `memory-map`: what the memory-map viewer guarantees about the machines it
  describes - complete coverage of the address space, sub-regions on zoom, and
  region names taken from the machine's own documentation.

### Modified Capabilities

None. `memory-blocks` loses three e2e specs to the new capability's folder, but
none of its requirements change - the specs move because they were never about
machine-code blocks.

## Non-goals

- **Adding a TRS-80 memory map.** It remains the only dialect without one, and
  giving it a map is separate work with its own sourcing to do.
- **Changing the colours.** How regions are coloured, and how a group's
  sub-regions are distinguished once there are some, is the next change.
- **Adding ROM bands to the CPC.** Its ROMs are read-only overlays the Gate Array
  pages over RAM; writes always reach the RAM beneath. Drawing them as ROM would
  tell the user a POKE goes nowhere, which is false.
- **Splitting the CPC screen into its CRTC interleave blocks.** The eight 2K
  raster blocks are real and modelled in the emulator, but eight near-identical
  bands would cost more than they teach; the interleave is explained in the
  region's note instead.
- **Naming the ZX80's undocumented workspace.** That needs a ROM disassembly, not
  a memory-map edit.
- **Rendering region tables in `docs/reference/`.** The maps stay an in-IDE view.

## Impact

- **New:** `openspec/specs/memory-map/` (via this change's delta), `e2e/memory-map/`
  with the three moved specs plus a new zoom-detail spec.
- **Modified:** `memoryMap.ts` and `memoryMap.test.ts` for `zx80`, `zx81`,
  `cpc464` and `cpc6128`; `Sources:` docblocks across all twelve maps; any label
  the audit corrects.
- **Guarded by:** the shared `src/dialects/memoryMap.test.ts` added by the
  address de-duplication work, which enforces contiguity, one program run and
  unambiguous grouping on every new table; `cpc6128/memoryMap.test.ts`, which
  pins the two CPC tables to each other; `facts-crosscheck.test.ts`, which
  requires the ZX80/ZX81 maps to keep having no screen region and their program
  regions not to move; and `src/e2eCapabilityLayout.test.ts`, which checks the
  e2e folder↔capability mirror after the move.
- **Risk:** low. No viewer code changes - `memoryBands`, `memoryScale` and the
  activity overlay are all generic over the region list, and the existing e2e
  specs assert against the C64, BBC and Spectrum, none of which gain leaves.
