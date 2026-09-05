## Context

The porting guide is one VitePress page whose body is a Vue component, hosted
inside the IDE in an iframe and read on its own outside it. Its data comes from
`src/reference/`, and `docs/contributing/architecture.md` describes that seam and
the drawer that hosts it.

Two properties of the existing code decide most of this design:

- **Every machine's `MemoryMap` declares `addressSpace: 0x10000`.** All thirteen
  maps cover the same 64K, so two panes can share one address scale with no
  normalisation, and a horizontal line across the pair means the same address on
  both machines. If a machine with a different address space is ever added, this
  assumption becomes visible rather than silently wrong — see Risks.
- **The documentation bundle must not reach `src/dialects/registry.ts` or
  `src/emulator/**`.** The registry imports every dialect and each pulls in a
  Z80 or 6502 core. `src/components/machinePickerBoundary.test.ts` enforces this
  by resolving imports itself, so the failure names the module that crossed the
  line rather than showing up as a 400KB docs chunk.

## Goals / Non-Goals

**Goals:**

- The guide renders the *same* memory map the IDE renders, not a docs-side
  lookalike of it — one implementation, one set of colours, one set of region
  names.
- The two panes are always read at the same scale, so a difference in layout is
  read off the picture rather than reconstructed from two independent ones.
- Where the reader's own program is at hand, the maps say what that program does
  and where it lands, narrowing as the rest of the comparison narrows.
- The IDE's memory-map panel behaves exactly as it does today.

**Non-Goals:**

- Live memory activity in the guide (needs a running emulator).
- Linked selection between the panes.
- Any change to the maps themselves, or a map for the machine that has none.

## Decisions

### Import each machine's map directly, rather than mirroring it into `src/reference/`

The porting facts (`src/reference/facts.ts`) are hand-authored copies pinned to
the dialect sources by `facts-crosscheck.test.ts`, because prose like "32×24
text; 256×192 bitmap" has no structured source. A `MemoryMap` is different: it
*is* structured data, and copying it would mean thirteen duplicated region
tables kept honest by a deep-equality test — drift protection for a copy that
need not exist.

Instead the docs page imports `src/dialects/<id>/memoryMap.ts` directly.
Eleven of the thirteen already import nothing but a type and small local
constant modules. The two CPC maps reach `SCREEN_BASE` from
`src/emulator/cpc/memory.ts`, which imports `MemoryActivityBuffer`; that single
constant moves to the dialect that owns it, in the direction
`src/emulator/atom/atomMachine.ts` already takes when it imports
`src/dialects/atom/addresses`.

`DOCS_IMPORTABLE` in the boundary test then widens to cover the map modules and
the new view, so the rule keeps being enforced over the surface that grew rather
than being quietly outgrown.

*Alternative considered:* mirroring into `src/reference/memoryMaps.ts`, matching
the `facts.ts` precedent. Rejected — it buys nothing here and costs a
permanently duplicated dataset.

### Split `MemoryMapPanel` into a controlled view and an IDE wrapper

`MemoryMapPanel` reads the Zustand store directly, computes the program's write
sites with `pokeSites()`, and drives an OffscreenCanvas worker for the live
activity overlay. None of that can cross into the docs bundle, and two of the
three should not: the guide has no store and no emulator.

`MemoryMapView` takes everything as props and owns no state of its own. Zoom,
notation, detail, selection and scroll offset are all controlled, which is what
lets the pair drive both panes from one control and hold them in step across a
tab flip. The wrapper keeps the store wiring, the program analysis, the
out-of-range warning, the pinch/wheel gesture state, the scroll-anchor
`useLayoutEffect` and the activity canvas.

The activity overlay cannot move into the view: `activityRenderer.ts` imports
`src/emulator/memoryActivityBuffer`. The view therefore takes the canvas as an
`overlay` node and reports its band geometry back through a callback, so the
wrapper can feed `useMemoryActivity` without the view knowing an emulator
exists.

*Alternative considered:* leaving `MemoryMapPanel` alone and writing a
docs-side map. Rejected — two implementations of the same picture drift, and the
`memory-map` capability's guarantees about colour and naming would then have to
hold in two places.

### Declare the write-site shape in the view, don't import `PokeSite`

`MemoryMapView` must not import `src/editor/pokeAddresses.ts`. It declares the
minimal shape it draws — address, optional end address, approximate, role,
expression — and a test pins that shape as structurally satisfied by `PokeSite`.

This is the move `src/reference/compare.ts` already makes for the program
vocabulary, and for the same reason: the two sides agree by structure, checked
by a test, rather than by an import that would drag a module across a boundary.

### Extend the vocabulary payload rather than adding a second message

The guide already asks the app what the open program uses and is answered with a
vocabulary read as the machine being ported *from*. Write sites belong in that
same answer: they are a property of the same program read as the same language,
and `vocabularyReply()` already resolves the right dialect — including for a
program kept on a machine that cannot run it, which is exactly when a port
begins.

The payload's existing contract is that every field defaults to empty, because
the app and the guide are separately built bundles with their own service
workers and a cached older app answering without a newer field is a real case.
A missing `writeSites` therefore degrades to machine-layouts-only, which is the
behaviour this section would have had before the field existed.

### Tabs, not a stack, when width runs out

Below the guide's existing narrow breakpoint the pair becomes two tabs named for
the two machines. A vertical stack would fit, but it turns a comparison into two
separate pictures the reader has to hold in their head.

What makes the tabs work is that zoom, detail, notation **and scroll offset**
survive the flip: flipping shows the same address range on the other machine, so
the difference reads as a change. That is why scroll offset is part of the
shared pair state rather than internal to each pane.

Tabs are named for the machines rather than "From"/"To" because the capability
already requires that a chosen machine stay identifiable without reopening the
list. One media query covers both narrow cases — the guide runs inside an
iframe, so the docs frame's own width *is* the drawer's width.

### Remove the two address rows

`Screen base` and `Program start` were the table's account of a machine's
layout. Once the layout is drawn, keeping them reports one difference twice, and
the fact table is meant to be scanned.

The underlying `PortingFacts` fields stay: `src/reference/machineDescription.ts`
uses them to describe a machine to the assistant, and `facts-crosscheck.test.ts`
pins both to the dialect's real memory-map region starts — removing the fields
would delete a crosscheck to save two lines. `portDescription.ts` never carried
them, so what the assistant is handed for a port is untouched.

No machine loses information. The TRS-80 is the only machine with neither fact,
and the only one with no memory map, so its rows already read "No dedicated
screen RAM" and "—". Every machine that has an address to report has a map that
reports it in more detail.

## Dialect / MachineEmulator seam

**No impact.** No field is added to `Dialect` and no method to `MachineEmulator`.
The change reads `Dialect.memoryMap`, `Dialect.memoryWrites` and
`Dialect.addressNotation`, all of which already exist and are already what the
IDE's panel reads. The one structural move — `SCREEN_BASE` from
`src/emulator/cpc/memory.ts` to the CPC dialect — is a constant changing owner
within the existing layering, not a change to the seam's shape.

## Risks / Trade-offs

- **The shared-axis design assumes a 64K address space.** All thirteen maps
  declare it today, but a future machine need not. → The pair reads
  `addressSpace` from each map rather than hard-coding 64K, and a unit test
  asserts that every registered map shares one address space, so the day that
  stops being true it fails as a named assumption rather than as a subtly
  misaligned picture.

- **Splitting a 698-line component the IDE depends on can regress it.** →
  `e2e/memory-map/` is the gate, and it is run before the guide work starts
  rather than at the end. `zoom-detail.spec.ts` in particular guards four
  machines against their maps being flattened back to coarse form, which is the
  most likely way a careless extraction would break things.

- **Two 64K columns plus fanned-out labels is width-hungry, and the guide is
  read in a narrow drawer.** → The tabbed fallback, with the breakpoint measured
  in the docs frame, which is the drawer.

- **Write sites are best-effort.** `pokeSites()` resolves literals, tracked
  variables and loop starts, and flags the rest approximate. Drawn against the
  *target* machine the stakes are a little higher than in the IDE, because a
  marker there is an assertion about a machine the program was never written
  for. → The approximate marking the IDE already uses carries over unchanged,
  and the target pane's wording says where the addresses land rather than what
  the program will do.

- **The docs bundle grows by thirteen region tables.** → Small (roughly a
  hundred lines of data each) and it is data, not code; no emulator, tokenizer
  or registry comes with it, which is what the boundary test proves.

## Migration Plan

None required. No stored data, no URL format change, no API. A reader who
bookmarked a comparison sees the same pair with the maps added and two rows
gone. The vocabulary payload change is additive and defaulted in both
directions, so an older cached app and a newer guide interoperate.

## Open Questions

None blocking. Two deliberately deferred to follow-up work: linked selection
between the panes, and whether the memory-layout section should be one of the
things a reader can collapse.
