## Why

The comparison marks the addresses the open program writes to on both machines'
memory layouts — on the source's because that is where the program aimed them, on
the target's because that is where they would land. Marking is the right half of
the job; the conclusion is left to the reader's eye. Two bands of colour at the
same height mean "this POKE now writes into the BASIC program's own text", and
nothing on the page says it.

The data to say it is already there. Every region of every described layout
declares what kind of thing it is — ROM, screen, attributes, buffer, system
variables, program text, reserved — so the guide can already answer "this address
is ROM on the target" and "this address is in a buffer the target does not have".
Those are conclusions, and the reader currently has to reach them by eye, on a
picture they may be reading one pane at a time on a narrow screen.

## What Changes

- **Each of the program's write addresses is classified against the target.** The
  comparison says what sits at that address on the target machine and what that
  means for the write: it reaches the same kind of thing, it reaches something
  else, it reaches ROM and does nothing, or it reaches nothing at all because the
  target's address space does not extend that far.
- **The verdicts are reported as findings, not only as marks on a picture.** A
  reader who never scrolls the layouts still learns that four of their POKEs land
  in the target's BASIC program text.
- **Nothing is claimed that the data cannot support.** An address the analysis
  could only approximate is reported as approximate, as it already is on the
  layouts, and a machine with no described layout produces no verdicts rather
  than half of one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *Where the program's writes land on
  the target is reported* — stating the verdicts and their limits.

## Non-goals

- **Translating the addresses.** Telling a reader that a screen write should
  become the target's own screen base is per-machine advice; the guide already
  carries each machine's screen base in its facts and draws it on the layout. This
  change reports where the write goes, not what to change it to.
- **Analysing the program more deeply.** The write sites are the ones the IDE
  already resolves; no new analysis, no new approximation, and an address it could
  not resolve stays unresolved.
- **Verdicts on reads.** `PEEK` is a different question with a different failure
  mode, and the write sites are what the comparison collects.
- **Replacing the marked layouts.** The picture stays; this adds the sentence.
- **Machines with no described layout.** They report no layout today and report no
  verdicts here.

## Impact

Affected code:

- `src/reference/compare.ts` + `compare.test.ts` — a pure classification of each
  write site against the two layouts, taking both maps as arguments (a memory map
  is plain data, and the type is already imported by the page).
- `docs/.vitepress/theme/components/DialectCompare.vue` — reports the verdicts
  alongside the memory layout section.
- `src/ai/portReport.ts` + `portDescription.ts` — the verdicts join what the
  assistant is handed for the port, where the write sites already travel.
- `e2e/porting-guidance/memory-layout.spec.ts` — one assertion.

Related but independent: the requirement that the layouts are marked with the
program's writes belongs to the memory-layout work already complete and awaiting
archive. This change adds a requirement of its own rather than modifying that
one, so the two can be archived in either order.

No dependency changes, no storage or share-format changes, and no change to any
dialect's memory map.
