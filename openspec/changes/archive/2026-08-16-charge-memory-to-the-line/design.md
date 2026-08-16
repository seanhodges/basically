## Context

The profiler's two measurements are collected in two different places, at two
very different resolutions. Per-line costs are collected **inside** the machine:
each machine that can report its executing line owns a shared recorder that the
CPU step drives, sampling the current line every few cycles. Memory is collected
**outside** the machine: the run loop polls the machine's aggregate in-use
figure about twice a second and appends a sample to a series.

That asymmetry is why a run can say where its time went but not where its memory
went. The fix is to move memory attribution to where line attribution already
is. See `docs/contributing/architecture.md` for the run-loop and dialect-seam
shape this sits inside.

## Goals / Non-Goals

**Goals:**

- Charge growth in BASIC RAM to the line that was executing when it grew,
  accurately enough that a neighbouring line is not credited with it.
- Reuse the routine roll-up the time side already computes, rather than growing
  a second implementation of the same outline walk.
- Keep recording always-on: whatever this costs must stay negligible against a
  frame budget, because the profiler has no arming step to hide it behind.
- Keep the "say what you cannot measure" contract: a machine that cannot
  attribute honestly reports nothing rather than something plausible.

**Non-Goals:**

- Inclusive attribution, per-area breakdown, gutter marking, reclaim
  attribution — see the proposal's non-goals.
- Changing how the existing memory series is sampled. The chart's cadence and
  retention are untouched.

## Decisions

### Attribute at BASIC line boundaries, inside the machine

The shared recorder is already called with the currently executing line every
few cycles, so it can see the line *change*. A change is both the moment
attribution needs and a moment when BASIC's own pointers are meaningful: on
entry to a new line the previous line's work is finished, and the interpreter is
between statements rather than mid-expression.

So: when the sampled line differs from the last one, read the machine's in-use
figure, charge the rise since the previous reading to the line that just ended,
and re-baseline.

**Alternative considered as the primary method — spread each sampling window's
rise across the lines that ran in it, weighted by cycles.** This needs no
machine changes at all, since the run loop already receives per-frame per-line
costs. It was rejected *as the primary* because it is wrong in the case the
feature exists for: where one line extends a string and the next prints it, the
print dominates the cycles, so the growth is charged to the line that printed. A
confident wrong answer is worse than none.

It is kept as a **fallback**, which is a different question — see below.

### The spread is the fallback where nothing could be charged

Charging a line requires observing the program leave it. A loop written on one
line (`10 A$=A$+"X":GOTO 10`) never does, and BASIC invites exactly that,
particularly where speed matters. Such a program can fill memory across a whole
run and have nothing charged for it, leaving an empty breakdown beside a rising
chart — which reads as a program that takes no memory.

So where the run's figure rose and none of it was charged, spread each window's
rise over the lines that were running, weighted by their cycles, and mark the
result approximate. In the case that motivates it the spread is exact anyway,
because only one line ran.

**All-or-nothing, never mixed.** The exact reading is used whole where it
charged anything, and the spread whole where it charged nothing. Filling in the
lines an exact reading priced at zero would credit a line that genuinely took
nothing for the cycles it happened to burn — which is the answer the exact
method exists to avoid — and would leave a ranking whose figures cannot be told
apart.

**Measured, not assumed.** The gap above was found by measurement, and so was a
case that turned out *not* to need the fallback: a Commodore whose string heap
has filled does stall inside one line reclaiming, but its reported figure has
plateaued at the ceiling by then, so there is no rise to spread. The fallback
covers programs whose structure hides the line change, not machines whose
memory stalls.

**Alternative considered — read memory on every sample rather than every line
change.** Sampling happens every few cycles; a reading is several bus reads.
That is two orders of magnitude more work for no more information, since memory
cannot change without an instruction executing and the interpreter's pointers
only settle between statements anyway.

### Carry the bytes on the existing per-line cost, not a new seam method

**Seam impact: one optional field, no new method.** The `MachineEmulator`
contract already drains per-line costs; those entries gain an optional bytes
field. A machine that cannot attribute simply never sets it, and the app reads
its absence as "unavailable" — the same null-means-unavailable convention the
per-line costs and the memory account already use. No machine gains a method, no
dialect gains a capability flag, and machines outside the profile are untouched.

**Alternative considered — a second drain method** (`drainMemoryProfile()`).
Rejected: it doubles the seam surface for data collected by the same recorder at
the same moment, and the run loop would have to keep the two drains in step.

### Gross rises only; falls re-baseline

A fall means BASIC reclaimed, and the reclaim is not the taking. Subtracting it
would report the string-builder — the line the feature exists to find — as
having taken nothing. Falls therefore reset the baseline without charging, which
also stops the bytes being counted twice when they are taken again.

### The account carries its accuracy, and four readings are distinct

Nothing downstream could work out whether a figure was charged or spread, so the
accuracy travels with the figures. The run publishes one of four answers, and
they are four different facts: lines were charged; nothing was charged but a
rise could be spread; a figure was read and no memory was taken; no figure was
ever read. The last two are the ones most easily conflated, and conflating them
tells a user their program is frugal when in truth nothing was measured.

### The field is present only once a real reading has landed

The recorder tracks whether any reading ever succeeded. Until one has, drained
entries carry no bytes field at all rather than a zero, so a machine that is
mid-boot, mid-injection, or simply unable to report is never described as having
allocated nothing. This is what makes the spec's "unavailable is not zero" rule
hold through the whole pipeline rather than only at the last hop.

### Bytes, not shares

Per-line time is reported as a share because clock rates differ between machines
and a cycle count means nothing on its own. A byte does not have that problem,
and "how much memory" is the question being asked. A share still drives the bar
width, so the ranking is readable at a glance.

## Risks / Trade-offs

- **Workspace movement read as allocation.** Two families compute their in-use
  figure from pointers that move within a line rather than only across lines:
  the Sinclair Spectrums include the calculator stack, which grows and collapses
  during expression evaluation, and the ZX80/ZX81 include the display file,
  which grows as printing scrolls. → Sampling at the line boundary is the
  quietest available moment, but this is an assumption about ROM behaviour, not
  a deduction. Validate it against the real ROMs before building anything on
  top: run a probe program on every registered machine and read the attribution
  back. Where a machine proves too noisy to be honest about, it reports no
  allocation account — the spec already carries that outcome, and the observable
  capability table already has the shape to record it.

  The display-file case may prove to be true rather than noisy: on those
  machines the display file genuinely is BASIC RAM, so printing genuinely does
  take memory. If so it is disclosed, not hidden.

- **Extra reads perturbing a machine.** Attribution adds bus reads to a measured
  run that an unmeasured run does not make, and the capability's first
  requirement is that measuring changes nothing. → Every machine's reads are
  side-effect-free by construction, and the existing armed-versus-unarmed screen
  comparison across each emulator family is the check that this stays true.

- **Host reads polluting the memory-activity overlay.** On the BBC, pointer
  reads go through the same path the overlay stamps from; the line walk already
  suspends the overlay for exactly this reason, and the memory-figure read does
  not. → Suspend it there too. This also fixes the existing case, where the
  half-second live-RAM poll already paints reads the program never made.

- **Cost of always-on recording.** → The reads happen once per BASIC line
  executed, against a sampler already reading the current line hundreds of times
  more often. Re-measure the per-machine overhead and update the recorded
  figures, since they are the justification for recording without an arming
  step.
