## Context

The debugger exists and works. `MachineEmulator` declares `currentLine()` and
`debugStep(opts)`; `DebugStepOptions` carries the breakpointed line numbers, a
mode of `run` or `step`, and the line the caller resumed from. Each machine
builds both its `runFrame` and its `debugStep` from one contract
(`src/emulator/machineLoop.ts`), so the stopping path is the machine's own rather
than something a caller assembles, and `Dialect.debuggable` declares whether a
machine has one — crosschecked against what it actually implements by
`src/dialects/debugCapability.test.ts`.

The only consumer is the browser. `src/components/EmulatorPane.tsx` calls
`debugStep` per would-be frame, keeps the resumed-from line in a ref between
slices, and publishes the paused line to the store. Outside the browser, the
runner that holds a machine for every caller —
`createServerMachine` in `src/mcp/session.ts`, reached by the host through
`createInProcessHolder` and by the worker holder in `src/server/machineWorker.ts`
— advances it with a bare `machine.runFrame()` and has no notion of a line at
all.

`docs/contributing/architecture.md` has the map of the layers named here and of
what a held machine is; this document does not restate it.

## Goals / Non-Goals

**Goals:**

- Every caller that can hold a machine can stop a program on a line, step it,
  continue it and ask where it is, on the same terms as everything else the
  toolchain offers.
- One account of "run until this line": the machine's own stopping path, driven
  the way the IDE drives it, not a second implementation written to match.
- A machine that cannot be stepped is answered rather than failed, and can be
  asked about before being asked to stop.
- A machine nobody has asked to stop keeps exactly the behaviour, the timing and
  the cost it has today.

**Non-Goals:**

- The `Dialect` / `MachineEmulator` seam. Nothing is added to it, removed from it
  or altered. Every member this change needs — `currentLine`, `debugStep`,
  `isProgramRunning`, `readVariables`, `readReport` — is already declared and
  already implemented by the machines that have one. **No machine gains
  machine-specific code for this**, which is deliberate and is why a machine that
  steps badly here is a machine that steps badly in the IDE.
- The browser IDE, its gutter, its toolbar and its variable watcher.
- The schedule vocabulary, memory and register access, writing a variable, and
  everything else the proposal lists as a non-goal.

## Decisions

### The stopping path is the machine's, and the resumed-from line is the caller's

**Decision.** The held-machine runner calls `machine.debugStep({breakpoints,
mode, fromLine})` in place of `machine.runFrame()` whenever a breakpoint is set
or a step has been asked for, and keeps `fromLine` beside the machine as the IDE
keeps it beside the pane. A machine with no `debugStep` never takes this path.

**Why.** `fromLine` cannot live in the machine: `DebugStepOptions` documents it
as the line the caller resumed from, threaded through every slice because a slice
may exhaust its budget while still on that line. It is what makes continuing off
a breakpointed line not re-trigger on the spot, and what "run until the line
differs" is measured against. A machine that remembered it would be remembering a
caller's intention, and two callers holding two machines would each need their
own — which is exactly what a held machine already is.

**Alternatives considered.** *Ask the machine to hold the breakpoints* — moves
per-caller state into the seam and would need a new member on it, for nothing.
*Re-derive the resumed-from line from `currentLine()` each slice* — that is the
line the machine is on, not the line the caller resumed from; on a slow line they
are the same and on the line after they are not, which is the one case the whole
mechanism exists to get right.

### A step folds what a frame folds

**Decision.** The stopping path is supplied to the driver the way the plain frame
advance already is — as a function the holder passes in, not as the machine
itself. Whatever the holder folds into each frame (a view's sampled picture, a
profile's per-line charge, a run's frame count) is folded into a debug step
identically.

**Why.** `createMachineControl` takes a `step: () => void` precisely so the
caller's per-frame work happens on every frame the driver spends, and both
sessions supply their own. A driver that reached past it to `machine.debugStep`
would spend frames the run never counted and never painted, so a machine
stepped by hand would stop being watchable and stop being measured — the two
things a debug session most needs. Handing the stopping path in the same way
keeps one rule: frames spent through the driver are frames the holder saw.

### Four operations, not one with a mode

**Decision.** `break`, `step`, `continue` and `where`, declared separately.

**Why.** It is how the layer is already shaped: `look`, `screenshot`, `profile`,
`time` and `variables` are five operations that all read one held machine, and
the command line reads as verbs because of it. Each of these four also differs in
the two things a declaration has to state — what it needs and what it does to a
machine being played — so folding them into one would make a single declaration
that had to answer both ways at once.

### Breakpoints reach a program before it starts, so a run takes them too

**Decision.** `break` acts on a machine a caller holds. A run also accepts the
lines to stop on, and a run that stopped reports that it stopped and where,
rather than that it ended.

**Why.** Every operation that acts on a machine needs one to be held, and a
machine is held by having run something. So a caller that could only reach
`break` after a run would be setting breakpoints on a program that had already
finished. The run is the only moment before the program starts, so it is the
moment the first breakpoints arrive; `break` is for changing them between stops,
which is the other half and cannot be done by a run at all.

**Alternatives considered.** *Let `break` need no machine and remember the lines
for a run to come* — makes an operation that acts on nothing and answers about
nothing, and leaves a caller unable to tell whether the lines it set are the
lines in force. *A separate operation that boots a machine without running
anything* — a bigger idea than this change, and one that would need an answer for
every machine about what a booted-but-idle machine is.

### Stepping and continuing are bounded, like everything else that runs a machine on

**Decision.** Continuing takes a bound on the frames it may spend and answers
that it reached neither a stop nor the end of the program when it exhausts it —
an ordinary outcome, not a failure. Stepping is bounded the same way. The bound
is the one a schedule's waits already use rather than a new number.

**Why.** Continuing a program with no further breakpoint, or one that loops
forever, is the ordinary case rather than the exceptional one: `10 GOTO 10` is a
BASIC program. Everything else that runs a held machine on already has this shape
— a wait for text or for the end of a program fails as an ordinary outcome after
its frames — and reusing the bound is what keeps "twenty seconds of machine time"
one fact about the toolchain rather than three.

### Debugging and playing are opposites, and so is asking to stop

**Decision.** `break`, `step` and `continue` are refused while a play channel is
open, naming the reason and how to stop, as measuring already is. `where` is
answered, of a machine that is moving.

**Why.** A played machine advances on a person's clock; a machine being stepped
advances only as far as a request asked. Asking a played machine to stop
somewhere is not merely unmeasurable, it is a request the machine will not
honour — so accepting it would leave a caller holding breakpoints that never
fire, which is the failure mode the projections were careful to avoid elsewhere.
`where` only reads, so it is answered under the rule that already covers reading
a moving machine: two reads may differ and that is not a fault.

**Alternatives considered.** *Allow `break` while playing, since it only records
lines* — defensible, and rejected because the lines it records are lines the
machine will run straight past.

### Whether a machine can be stepped is asked, never carried

**Decision.** Steppability is read from the machine's own declaration and
reported where a machine is described, so a caller can ask before it tries. A
caller that asks a machine that cannot be stepped to stop somewhere is told
plainly, with what it can still do.

**Why.** The alternative is a list of machines maintained beside the registry,
which the description requirement already forbids and which
`src/dialects/debugCapability.test.ts` exists to make unnecessary — it holds
every registered machine's declaration to what it implements, so the declaration
is the fact. An embedding application in particular must be able to ask: it may
be running against a copy of the toolchain that is not the one it shipped with.

### The assistant is deliberately absent

**Decision.** All four operations are offered to the command line and to an
agent, and declared absent from the assistant, each with its own reason.

**Why.** The assistant runs inside the IDE, where the machine it would step is
the one on the user's screen and the breakpoints are the ones the user set in the
gutter of the buffer they are looking at, with stepping and continuing already
on the toolbar and the stopped line already highlighted. The reason is the IDE
around this caller — the same circumstance that keeps `run`, `check` and `view`
from it — so it reaches no caller without one, and an agent, which holds a
machine nobody is looking at, is offered all four.

### The worker boundary gains a direction it already learned once

**Decision.** Where a caller's machine is in a worker, the debug requests cross
to it and the answers cross back, on the arrangement that already carries a key
toward a machine in a worker.

**Why.** A held machine is in this thread for a caller served over its own
streams and in a worker for a caller reaching a host, and both must answer the
same operations. Keys crossing toward a machine was the first thing to travel in
that direction; a request to stop, to step and to say where is the second, and
answering "where" needs a reply where pressing a key needed none.

## Risks / Trade-offs

- **A continue that never comes back** → A caller that continues a program with
  no further breakpoint spends its whole bound before answering, and a caller
  waiting on it sees the toolchain hang for twenty seconds of machine time.
  Mitigated by the bound being the caller's to name and by the outcome saying
  plainly that neither a stop nor an end was reached — but the wait is real, and
  it is the same wait a schedule's wait for the end of a program already has.
- **The stopping path is slower per frame than the plain one** → `debugStep`
  steps instruction by instruction and watches the line as it goes, where
  `runFrame` runs the budget out. A machine being stepped is therefore slower in
  wall-clock terms than one that is not, though not in the machine's own time,
  which is the time everything is measured in. A machine nobody has asked to stop
  never takes the path, which is what confines the cost to callers who asked
  for it.
- **A run that stops is a run that did not finish** → Every caller that renders a
  run's outcome has to render this, and one that assumed a run either ended or
  ran out of frames now has a third answer. The mitigation is that the outcome
  says so structurally rather than in prose, so a caller that ignores it reports
  a run that is still going, which is true.
- **Two machines that both say `debuggable` need not step alike** → Stated as a
  trade-off rather than a risk. Because no machine gains code for this, a machine
  whose line reporting lags its execution reports the same lag in the IDE, and
  the fault is not in this change. `src/dialects/debugCapability.test.ts` holds
  the declaration to the implementation; it cannot hold a machine to reporting a
  line at the moment a reader would expect.

## Open Questions

- Whether continuing should answer differently when the program stopped of its
  own accord — a runtime error rather than the end of the program. The machine
  can already say which it was, and a caller told "it ended" of a program that
  errored has been told something true and unhelpful; whether that belongs here
  or in what a run already reports is worth settling before the outcome shape is
  fixed.
- Whether a caller holding a machine it has stepped should be able to ask for the
  interval since the previous stop directly, or whether each step reporting what
  it cost is enough to add up. The IDE reports the interval; adding them up gives
  the same number only if nothing else advanced the machine in between.
