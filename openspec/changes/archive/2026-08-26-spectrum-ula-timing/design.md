## Context

Both Spectrum machines drive the shared frame/slice walk in
`src/emulator/machineLoop.ts`: one whole Z80 instruction per step, the overrun
carried into the next frame, and `afterStep` drawing every display line whose
ULA fetch time the frame has passed. See `docs/contributing/architecture.md` for
the seam this sits behind.

That structure is what makes this change small. The machine already knows the
frame T-state each step begins at, and already draws the picture against it. All
that is missing is the other half of the same clock: the T-states the ULA takes
back.

The vendored Z80 core is the constraint. It reports an instruction's total
T-states and nothing about when within it each access happened, and it must diff
cleanly against upstream, so contention is charged in the adapter — in bus
callbacks the machine wraps around the memory it already owns.

## Goals / Non-Goals

**Goals.** Charge the CPU the T-states the ULA really takes. Keep the vendored
core byte-identical. Keep the delay table pure and unit-testable without booting
a machine. Keep the contention window and the scanline the renderer draws on one
clock, so they cannot disagree.

**Non-goals.** The +2A/+3 pattern, the floating bus, the held INT window,
cycle-exact contention — see the proposal.

## Decisions

### The believed position, and why an estimate is enough

The clock keeps a believed frame T-state for the next bus access: repositioned to
the truth at every instruction boundary, and advanced by one M-cycle per access
in between — four T-states for an opcode fetch, three for a data access, four for
an I/O cycle. The core's M1 hook, which it already offers and which the ZX81 and
ZX80 already use, distinguishes the opcode fetch from a data read; a prefix byte
is not covered by it and is charged as a data read.

So the position is wrong by a few T-states inside an instruction. It cannot
accumulate, and that is the load-bearing fact rather than a hopeful one: the
delay table is 6,5,4,3,2,1,0,0, so a contended access always finishes at offset 6
or 7 of its eight-T block whatever offset it began at. Every contended access
re-quantises the position onto the ULA's grid. The residual is far below the
≤23 T instruction granularity the scanline chase already accepts against a 224 T
line.

Reusing the instruction's own start position for every access would have been
simpler and is worse in exactly the case that matters: it puts both halves of a
block instruction in the same slot of the pattern, and block instructions are
what raster code is written with.

### Only the CPU pays

The wrapped callbacks are the sole path the CPU takes. Everything the host does —
reading the executing BASIC line, the profiler's memory sampling, the tape traps,
injecting memory blocks, drawing a scanline — goes to the memory object directly
and is charged nothing, which is correct: none of it is time the emulated machine
spends. This is why the contention does not live inside `SpectrumMemory`, where
it would have billed the IDE's own introspection.

### One origin for the window and the picture

Each machine's display origin is now derived from its contention window — the
first pixel fetch is one T-state after the ULA takes the bus — rather than
written out beside it. The 48K's constant is unchanged at 14336. The 128K's moves
by one T-state, from 14361 to 14362, which is what the published figure has always
been; nothing asserted the old value, and one T-state out of a 228 T line is
invisible.

### Waiting is charged to the line that waited

The delay owed by an instruction is folded into the T-states that step returns,
so the frame budget, the beam chase and the profiler all see one figure. The
alternative — charging the frame but not the profiler — would leave the profiler
accounting for less than a whole frame, and would make the per-line cost of a
routine depend on where it happened to sit in memory without ever saying so.

A visible consequence, worth stating because it moved a test: the profiler
samples on a cycle cadence, so charging contention makes it sample after fewer
instructions and read the machine's memory figure at more line boundaries. The
reading gets finer, and a few bytes of the ROM's own loop bookkeeping now land on
the line they happen under rather than on its neighbour. `lineProfiling.test.ts`
had asserted exactly zero there; it now bounds it, which is the invariant it was
really guarding.

### The interrupt is offered for a window, not an instant

The ULA pulls /INT low once a frame and holds it for 32 T-states — long enough,
the hardware documentation notes, for any instruction to finish and respond,
since the Z80 samples the line only at the end of one. The machine used to offer
the interrupt at a single instant and check `IFF1` there; a routine that happened
to have interrupts off at that moment lost the frame's handler outright.

So the interrupt is now latched at the top of the slice and retired in the step:
taken at the first instruction boundary inside the window at which interrupts are
enabled, and dropped when the ULA lets go with them still off — which is what the
machine does to a long `DI` region. Deciding it in the step rather than at the
slice start is also what puts the acknowledgement's stack push after the
contention clock has been positioned, so that push is contended like any other.

The 128K's ULA is not separately documented on this point and is assumed to match
the 48K. The assumption is cheap: what the figure decides is only how far past
the frame boundary a `DI` region may run and still catch the interrupt, and 32
T-states is already several instructions.

### The floating bus is left alone, and why that is the accurate choice

Reading an unclaimed port still returns 0xFF. The sources place the ULA's fetch
slots 12 T-states (48K) and 7 T-states (128K) past their own machines' contention
origins, which cannot both be right against one clock; they also document the
"idle" four T-states of each block as holding the last contended-memory value
rather than 0xFF, and note that every figure shifts by one on late-timing
machines. A bus modelled on an unresolved phase would let a program sync and then
paint three columns off — a worse failure than not syncing, because it looks like
working code. The proposal records what would unblock it.

### `onSliceStart` learns where the slice opens

The frame interrupt's acknowledgement pushes a return address, and that push is
contended like any other write, so the clock has to be placed before the
interrupt is raised — at the position the slice actually opens at, which is the
overrun carried from the last one, not zero. The shared contract gains that
argument. Every other machine ignores it.

## Risks / Trade-offs

**Both Spectrums get slower.** That is the point, but it moves measured figures.
Both published loop speeds are re-taken; the loop-speed test's 20% tolerance
absorbs a shift of this size in either direction, so the test passing is not
evidence the figure is right — it has to be measured again.

**It is on the hottest path in the machine.** Every bus access asks whether its
address is contended, millions of times a second. The address test is one mask
and compare, and the frame-position test short-circuits for the first 14335
T-states of every frame, which is where most of a frame's accesses fall.

**Programs that lost interrupts now get them.** A routine that disabled
interrupts across the frame boundary used to skip that frame's handler; it no
longer does. That is the fix, but it means a program's frame counter, keyboard
scan and any interrupt-driven effect can all advance where they used to stall.

**The picture is now sensitive to where code sits.** A routine that used to run
at one speed anywhere in RAM now runs at two, which is authentic and will
surprise anyone who had tuned a delay against the old behaviour.
