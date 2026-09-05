## Context

`ProgramVocabulary.writeSites` carries the addresses the open program writes to,
resolved for the machine being ported from, each marked as computed or
approximate. The comparison draws them on both machines' layouts. A `MemoryMap`
is plain data — regions with a start, an end, a label and a kind — which is what
lets the docs bundle import the dialects' maps directly without reaching the
registry (`machinePickerBoundary.test.ts` holds that line, and
`docs/contributing/architecture.md` explains why it exists).

`MemoryRegionKind` is a closed vocabulary: `rom`, `screen`, `attributes`,
`buffer`, `system`, `program`, `reserved`. That is enough to classify a landing
without inventing anything.

## Goals / Non-Goals

**Goals**

- Turn "two bands line up" into a sentence.
- Say only what the region kinds support.
- Keep the classification pure and testable.

**Non-Goals**

- Rewriting addresses, analysing reads, or resolving addresses the IDE could not.

## Decisions

### Impact on the Dialect seam: none

No dialect is touched. `compare.ts` gains a type-only import of `MemoryMap` and
`MemoryRegionKind`, which erases at build time and reaches no runtime module —
the page already imports the same type, and the purity rule is about what the
bundle pulls in, not about which types are named.

### Four verdicts, from the two kinds

```
  source region kind   target region kind     verdict
  ──────────────────   ──────────────────     ─────────────────────────────
  screen               screen                 same kind, different address
  screen               program                lands in something else
  anything             rom                    lands in ROM: the write is lost
  anything             (outside the space)    the target has no such address
```

- **Same kind** is not "no work": the addresses differ, which is exactly what the
  layouts are drawn to scale to show. It is reported as the mildest verdict, not
  as silence, because a hard-coded screen address is still wrong on the target.
- **Lands in something else** names both sides — what the program aimed at and
  what it would reach — because the two together are the finding. A write aimed
  at system variables that reaches the BASIC program text corrupts the program;
  the reader needs both halves to see why.
- **Lands in ROM** is its own verdict rather than a case of "something else": the
  write is not merely wrong, it does nothing at all, and the failure looks like
  the statement having been skipped.
- **No such address** covers a target with a smaller address space, and is
  reported as the write having nowhere to go.

A verdict is per site, and sites sharing a verdict and a target region are
reported together — a loop of eight POKEs into the same buffer is one finding
with eight addresses, not eight findings.

### Approximate addresses keep their doubt

A site the IDE could only approximate carries that flag into the verdict, and the
verdict is stated as an estimate. This is the same discipline the layouts already
follow, and the same one the fit report and the narrowing notice follow: state
what is known, mark what is not, never launder an approximation into a
conclusion.

An approximate address that would change verdict a few bytes either way is
reported as approximate, not suppressed. Suppressing it would hide the one case
where the reader most wants to look.

### Where the verdicts read

With the memory layout, which is what they are about, and which is where a reader
who has scrolled the maps will look for them. The layouts stay as they are.

Where either machine has no described layout there is no layout section, and
there are no verdicts — the existing behaviour, unchanged: half a comparison of
two address spaces is worse than none.

## Risks / Trade-offs

- **A verdict is only as good as the region boundaries.** → The maps are pinned
  per machine by `src/dialects/memoryMap.test.ts` and are the same data the IDE's
  own map view draws.
- **"Same kind, different address" could read as reassurance.** → It is worded as
  work: the address has to change, and the layouts show by how much.
- **A program with many write sites produces many verdicts.** → Grouped by
  verdict and target region, and subject to the existing cap on long lists.
- **The type-only import could be mistaken for a licence to import runtime code
  from `src/dialects/`.** → A comment at the import says which it is and why, in
  the same terms the module header already uses.
