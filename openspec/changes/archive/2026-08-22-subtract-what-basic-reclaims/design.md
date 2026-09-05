# Design

## Seam impact

None. `MachineEmulator` gains no method: the figure already reaches the profiler
through `LineCost`, which grows one optional field beside `allocated`. Machines
that cannot attribute memory are unaffected - see the capability signal below.

Layering is as `docs/contributing/architecture.md` describes it: the machine
reports, the profiler accounts, the dialog reads.

## Where the subtraction happens

At the same boundary the rise is already read: the change of BASIC line. The
recorder holds the previous in-use figure, and the difference is signed, so
measuring the fall is the branch that was previously being discarded. Nothing is
sampled more often and no extra read is taken, which is what keeps recording
affordable enough to be armed for a whole run.

A fall re-baselines exactly as a rise does, so bytes reclaimed and then taken
again are charged once each rather than the second taking being measured from the
low point.

## Two figures, not one signed one

`LineCost.allocated` could have become signed. It does not, for two reasons.

The first is the capability signal. A machine that cannot attribute its memory
must be indistinguishable from one that reports nothing, never one reporting
zeroes, or a program that takes memory somewhere the machine's figure cannot see
reads as a program that takes none. That signal is the field's absence. Adding a
second field that is present and absent with the first keeps one signal rather
than two.

The second is the reclaim pause. A line that takes 16K and gives 16K back nets to
nothing, and it is the most interesting line on the panel. Only the pair can tell
it from a line that did nothing.

## Charging the fall to the line that was running

Not to the line that originally took the memory. Nothing a machine reports says
which allocation a collection freed - the figure is a single total - so that
attribution is not available at any price.

The line the collection ran on is available, and is the more useful of the two
anyway: it is where the program stalled. Measured across the bundled churn probe,
which line that turns out to be is the ROM's business and varies: the Sinclairs
give the bytes back on the `NEXT` and on the assignment that drops the string,
while the PET and VIC-20 collect inside the line doing the building.

## Ordering by the size of the move

The ranking sorts on the absolute net rather than the signed one, so a line that
gave 8K back ranks beside one that took 8K. A reclaim is where a program stalls,
and ranking it below every line that took anything would push it off the end of a
truncated list. The bar is scaled against the largest absolute net for the same
reason a share cannot be taken of the total any more: on a program that gives back
what it takes, the total nets to nothing and every share would divide by it.

The bar cannot show direction, so colour does - a reclaim is drawn apart from the
blue the memory chart and the taking rows use.

## A line that moved nothing is still absent

The filter is "moved memory in either direction", not "has a non-zero net". A line
that takes a thousand bytes and gives the thousand back moved memory, and dropping
it would leave the panel reporting that nothing happened. A line that never moved
any is absent, as it was before, and as the gutter leaves a line that never ran
unmarked.
