# Subtract what BASIC reclaims

## Why

The profiler charges a run's memory to the line that took it, gross: only rises
in the machine's own BASIC memory figure are counted, and every fall is dropped.
The reasoning was that a reclaim is not a taking, and that netting would report
the line responsible for a Commodore's reclaim pause as having taken nothing.

It costs more than it buys. The headline figure answers a question nobody asked -
how much memory a program would have used had BASIC never collected any of it -
so on a machine that reclaims as it goes, the total bears no relation to the
memory the program actually holds. The panel then has to explain itself, and the
explanation was four lines of prose under every reading.

Measuring falls costs one more subtraction at a boundary the profiler already
stops at, and it turns out to name a line worth naming. Measured across the
bundled string-churn probe: the Sinclair ROMs give the bytes back on the `NEXT`
and on the assignment that drops the string; the PET and VIC-20 collect inside
the line doing the building, which then both takes and reclaims; the C64's heap
is large enough that a bounded probe never triggers a collection at all. All
three are worth being able to see, and none of them is visible today.

Both figures are kept rather than only the difference. A line that takes a great
deal and gives nearly all of it back is what a reclaim pause is made of, and
against a net alone it reads as a line that did nothing - the objection that
motivated the gross figure in the first place. Reporting the pair answers it
without making the total meaningless.

## What changes

- Falls in the machine's BASIC memory figure are charged to the line that was
  executing when they happened, as rises already are.
- A line's headline figure becomes what it was left holding: taken minus
  reclaimed, which can be negative.
- The taken and the reclaimed are reported beside the net, so a line that churned
  can be told from one that did nothing.
- The approximate fallback spreads falls over the window's lines exactly as it
  spreads rises.
- The prose disclosure under the reading is dropped in favour of the figures.
  What a line's figure covers is the user guide's to explain.

## Non-goals

- Attributing a reclaim to the line that originally took the memory. Nothing the
  machine reports says which allocation a collection freed, and guessing would be
  a worse answer than naming the line the collection ran on.
- Reporting a peak per line. The run-wide peak is unchanged, and a per-line one
  would need a reading inside a line rather than at its boundaries.
- Changing which machines can attribute memory at all, or what range of RAM each
  one's figure spans.

## Affected specs

- `openspec/specs/profiling/spec.md` - the requirement "Memory is charged to the
  line that took it, and says so".
