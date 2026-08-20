## Context

The IDE already reads a great deal out of a running machine - the executing
BASIC line, the BASIC RAM pointers, the variables, the screen - through
optional members on `MachineEmulator`. `docs/contributing/architecture.md`
describes that seam and how machines sit behind it; this design does not
restate it.

Three existing facts shape everything below.

**Emulation is paced against real time on purpose.** `src/app/frameClock.ts`
converts elapsed wall-clock time into a count of whole emulated frames
precisely so that the display's refresh rate cannot change how much emulated
time passes. Any measurement taken from the host clock would contradict that.

**Noticing a line transition is already solved.** `debugStep` on every
debuggable machine watches for the executing line changing, and the C64's
implementation documents the cadence question: it samples every
`DEBUG_SLICE_CYCLES` (8) cycles on the grounds that no BASIC line is shorter
than that, so a transition is never stepped over while the always-on debugger's
per-frame overhead stays small.

**"Record only while something is watching" is an established pattern.**
`setMemoryActivityRecording` / `drainMemoryActivity` is off by default, costs a
not-taken branch on the CPU's memory hot path when off, and is armed only while
the memory-map overlay is mounted.

The machines are not uniform in what they can answer. Reading each machine
class: `currentLine()` is implemented by the ZX81, ZX80, both Spectrums, the
BBC, the PET, the VIC-20, the C64, the CPC and the TRS-80 interpreter, and is
absent on the Atom, the Altair and the TRS-80 emulator. `readMemoryStats()` is
implemented by all of those except both TRS-80 machines. The TRS-80 interpreter
is a further special case: it executes statements rather than Z80 cycles and
has no cycle budget at all - it can name the line it is on, but has no clock to
charge to it.

## Goals / Non-Goals

**Goals:**

- Measure a run in emulated time, so the figures describe the machine rather
  than the browser and are unaffected by the speed multiplier.
- Attribute that time to BASIC lines, and show a line's share beside the line.
- Record BASIC RAM use across the run as a series, not a latest value.
- Cost nothing measurable on machines and runs that are not being profiled.
- Let the assistant fetch the profile without destabilising the cached prefix.
- Degrade per machine, on the evidence of what the machine implements.

**Non-Goals:**

- Inclusive (caller-attributed) costs, statement-level costs, host-side
  emulation cost, and stopwatch timing - all as stated in the proposal.
- Profiling anything below the BASIC line.

## Decisions

### Report emulated time, counted in the machine's own cycles

Time is reported as time on the emulated machine. A run's whole duration comes
from frames (every machine has `frameHz`, and `frames / frameHz` is seconds);
the per-line costs inside it are CPU cycles, which is the only clock fine
enough to separate one BASIC line from another.

*Why:* it is the only figure that is a property of the program. It is stable
across hosts, across display refresh rates, and across the speed multiplier, so
profiling a long program at 4x costs the user less time and changes no number.
It is also the figure a retro-computing user actually wants: "this takes 4.2
seconds on a real ZX81".

*Alternative rejected:* host wall-clock time. It varies by machine and
thermals, it is not reproducible, and reporting it would contradict the
invariant `frameClock.ts` exists to hold.

*Consequence:* a machine with no cycles to count is not profiled. That is the
TRS-80's backend, which interprets BASIC statements rather than executing a CPU
over a RAM image. It could be given a made-up currency of its own - statements,
or fractions of a frame - but then every figure in the IDE would have to carry
which currency it was in, for one machine, in a unit the hardware never had.
One unit, and a machine that cannot answer in it says so, on exactly the same
terms as the Atom and the Altair saying they cannot name a line.

### A new optional seam pair, modelled on memory-activity recording

**Seam impact: additive and optional.** Two new optional members on
`MachineEmulator`, alongside the existing optional introspection members:

- `setProfileRecording?(enabled: boolean): void`
- `drainProfile?(): <line costs> | null`

Detected by `typeof machine.x === 'function'`, exactly like `readVariables`,
`debugStep` and `drainMemoryActivity`. No existing member changes shape, and no
machine is obliged to implement either.

*Why a seam pair rather than deriving it host-side:* the host cannot see line
transitions. It could only poll `currentLine()` once per frame, which would
sample far too coarsely to attribute a loop, and would still cost a memory read
per frame on every machine.

*Why it mirrors memory activity rather than inventing a shape:* the contract is
already written and already understood - off by default, cheap when off, armed
by whoever is watching, drained in whole units. Following it means one pattern
to learn rather than two.

### Instrument the shared stepper, not `debugStep`

Each machine accumulates cost inside the single step function that both
`runFrame` and `debugStep` funnel through - the ZX81's `stepInstruction()`, the
C64's `tickOnce()`, and each other machine's equivalent.

*Why not `debugStep`, which already watches line transitions:* because a run
the IDE performs to check an assistant answer deliberately does **not** open a
debug session. `shouldOpenDebugSession` in `src/app/aiRunCheck.ts` returns false
for a check, and explains why: `debuggable` is a property of the machine, not of
whether the user is debugging, so a check that inherited it would pause on the
user's breakpoints and never reach a verdict. Hooking `debugStep` would
therefore silently fail to profile exactly those runs, and would also skip every
non-debuggable machine.

Instrumenting the shared stepper covers ordinary runs, debugger slices and
checks with one hook.

### Sample on the cadence the C64 already justified

Where a machine steps in cycles, sample the executing line on the same cadence
its debugger uses rather than on every instruction.

*Why:* the reasoning is already worked out and recorded - no BASIC line is
shorter than the slice, so no transition is missed, and sampling less often is
what keeps the per-frame overhead small. Inventing a second cadence would mean
a second, unjustified constant per machine.

### Recording is armed for the run, and costs a not-taken branch when off

The run loop arms recording when it starts a machine and disarms it when the
machine goes away, rather than a panel arming it.

*Why always-on rather than a Profile action:* the heat is shown in the editor
gutter, so there is no panel whose lifetime could arm it; and a profiling mode
is a mode the user has to know about before the run they wanted to measure, not
after. The always-on debugger sets the precedent.

*Why this is affordable:* the same reason the memory-activity recorder is - the
cost when disabled is a not-taken branch, and the cost when enabled is one
already-cheap memory read per slice. This is nonetheless the risk worth
measuring before the change lands (see below).

### Host introspection reads through the unwrapped bus

Where a machine wraps its CPU bus to record memory activity, the profiler's own
reads must go through the unwrapped accessor.

*Why:* the C64 already established this with `rawCpuRead`, captured before the
activity-recording wrappers are installed, so that host-side polling never shows
up as program activity in the memory-map overlay. A profiler reading `currentLine`
through the wrapped bus would paint the overlay with the IDE's own reads.

### Flat attribution, stated as flat

Cost is charged to the line executing when the sample is taken.

*Why not inclusive costs:* attributing a subroutine's time back to its callers
needs each machine's GOSUB stack decoded - a separate piece of per-machine
hardware research for every machine, of the kind the Altair's comment warns
about doing on a plausible guess. Flat costs are exactly true; inclusive costs
would be a much larger change.

*Trade-off accepted:* a program whose work is in a subroutine shows the cost on
the subroutine, not on the loop that calls it. The UI must say so rather than
let the user infer otherwise. Rolling lines up into the procedures and GOSUB
entry points that `src/editor/programOutline.ts` already extracts gives a
structural view without introducing a section concept.

### Memory sampling stays host-side

The memory series is sampled by the run loop from the existing
`readMemoryStats()`, not through a new seam member.

*Why:* the figures are already reachable, already polled for the status bar, and
are a whole-machine reading rather than something attributable to a line. There
is nothing for a machine to accumulate.

*What changes from the existing poll:* the status-bar poll is a 500 ms interval
producing a latest value. The profile needs a series anchored to the run's own
emulated time, sampled on a frame cadence, reset when a run starts, and bounded
so a long run cannot grow it without limit.

### The assistant gets a tool, not automatic context

A profile tool joins the fixed tool set rather than profile data being appended
to requests.

*Why:* `stabilise-the-cached-prefix` establishes that tools are rendered ahead
of the system prompt, so a tool set that appears and disappears invalidates
everything behind it - and that varying content inside the cached prefix is
what makes the whole prefix be paid for at the write premium every turn. A
profile appended to every request would vary on every turn by construction. A
tool is fetched only when the assistant is actually working on speed.

*Consequence:* the tool must be offered on the same terms as the existing
`drive` and `look` tools - resolved once per conversation from the provider, not
conditionally on a machine being up. Which dialects can answer it is recorded
per-dialect in `src/ai/machineObservability.ts`, which exists because the system
prompt is built from the `Dialect` alone and must be byte-stable per dialect;
its crosscheck test constructs every registered machine and fails if the table
drifts from what the machines implement.

### Heat is drawn in the gutter that already exists

The per-line share is a third layer in the combined gutter that already renders
lint markers and breakpoint dots, reconfigured through a compartment the way the
breakpoint set already is.

*Why:* that gutter already resolves precedence between two marker kinds and
already re-renders from a store selector when its data changes. A second gutter
would double the horizontal cost of the editor and leave two things to keep
aligned.

*Consequence:* precedence between lint, breakpoint and heat has to be decided
explicitly, and heat has to be legible without competing with the marker dots.

## Risks / Trade-offs

- **Always-on recording costs time on the run hot path** → The cost is a
  not-taken branch when off and one memory read per slice when on, on the
  cadence the debugger already pays. Measure on the slowest core before the
  change lands; if it is not free enough, the fallback is arming recording only
  once a run has started rather than for the machine's whole life.
- **Flat costs mislead a user reading a GOSUB-heavy program** → State that costs
  are flat where they are shown, and offer the procedure rollup so the cost is
  at least visible against a named routine.
- **A line holding several statements is measured as one** → An honest limit of
  what the machines report; documented rather than hidden.
- **Sampling can under-count a line that is always short** → The cadence is
  chosen so no line is shorter than a slice, which is the same guarantee the
  debugger relies on to never step over a transition.
- **A machine with no cycles cannot be measured at all** (the TRS-80's
  statement interpreter) → It reports no per-line costs and says so, rather than
  answering in a second unit every figure downstream would have to carry. Shares
  of the run's total are what the gutter shows, so no consumer sees a cycle
  count either way.
- **The memory series grows without bound on a long run** → Bound it, and be
  explicit about what a bounded series means for a run longer than the bound.
- **Tool-set churn would undo the prefix-caching work** → The tool joins the
  fixed set. This change should land after `stabilise-the-cached-prefix`, or be
  reconciled with it deliberately if it lands first.
- **A machine that can report a line but not RAM, or vice versa** → Half a
  profile is offered rather than none, and the missing half says it is missing
  rather than reading as zero.
