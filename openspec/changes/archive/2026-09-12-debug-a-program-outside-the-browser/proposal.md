## Why

The IDE can stop a BASIC program on a line, show which line it stopped before,
step it a line at a time and continue it. Every machine that can say which line
it is executing offers this, and the guarantee that a debugger costs a program
nothing is already stated. None of it exists outside the browser. A caller with
a held machine can drive it, look at it, measure it and read its variables, but
it cannot stop a program anywhere; the only way to see a program part-way
through is to have written a schedule that happens to leave it there.

That is felt most by an application embedding the toolchain. An editor with the
whole language behind it can now run what its user has written, and the moment
the program misbehaves the user is back to inserting `PRINT` statements —
because the debugger that would tell them what line they are on, and what the
variables hold there, is somewhere they are not.

The mechanism is already built and already proven on every machine that has one.
It is simply not reachable from anywhere but the page.

## What Changes

- **A held machine can be told where to stop.** A caller names the BASIC line
  numbers a program is to stop before, and can change them between stops. Naming
  none clears them.
- **A run can be told where to stop.** Breakpoints have to be in place before
  the program starts or the program is over before anyone could set one, so a run
  takes them too, and reports that it stopped somewhere rather than that it
  ended.
- **A stopped program can be stepped and continued.** Stepping runs to the next
  BASIC line; continuing runs to the next stop, or to the end of the program.
  Each answers where the program now is and what it cost in the machine's own
  time, so a stretch of a program can be timed the way the IDE already times one.
- **A caller can ask where a stopped machine is** — the line it is stopped
  before, whether a program is running at all, and which lines it is set to stop
  on. A caller that lost track, or that has only just been handed a machine,
  needs no memory of its own.
- **A machine that cannot be stepped says so.** Not every machine can say which
  BASIC line it is executing, and one that cannot is told plainly, when asked
  about and when asked to stop, rather than accepting a breakpoint that would
  never be reached. Describing a machine says whether it can be stepped, so a
  caller can tell before trying.
- **Debugging and playing remain opposites.** A machine being played is running
  on a person's clock and is not a machine anything can stop, step or measure;
  those requests are refused while a play channel is open, saying so and how to
  stop, exactly as measuring one already is.
- **Stopping a program changes nothing about how it runs.** The guarantee the
  IDE already makes — that the presence of a debugger costs a program nothing —
  is made of the toolchain too.
- No existing behaviour changes and nothing is removed. A caller that never asks
  a machine to stop sees the toolchain it has today. **Not breaking.**

## Capabilities

### New Capabilities

- `machine-debug`: Stopping a program on a line, stepping it, continuing it and
  asking where it is stopped, on a machine a caller holds — what a caller must do
  to make a program stop, what it is told when it does, what stepping and
  continuing cost, what a machine that cannot be stepped says, and what
  debugging does and does not do to a program.

### Modified Capabilities

- `headless-cli`: The command line gains the operations, and gains the way to
  start a run that is going to stop. Describing a machine says whether it can be
  stepped. And a run told where to stop needs the machine's ROM for the same
  reason a run told what to press does — without one, no BASIC line is ever
  reached and the stop never comes.

`mcp-server` is deliberately absent. Its guarantee that every operation the
toolchain offers is offered to an agent is what carries these there; recording
that an agent gets them is the mechanism working rather than a change to it. The
same requirement is what obliges the assistant's deliberate absence to be
declared with its reason beside it.

`program-execution` is absent too. It owns the IDE's line-level debugging and
none of its guarantees change: the same breakpoints, the same paused line, the
same promise that a debugged run is indistinguishable from an undebugged one.
What changes is who else can ask for it.

`profiling` is absent for a narrower reason worth stating: it already guarantees
that the interval between one pause and the next can be timed, and says it of the
IDE. This change makes the toolchain answer the same thing rather than altering
what is promised, so the guarantee is mirrored in `machine-debug` where a caller
holding a machine will look for it, and `profiling`'s own wording stands.

## Non-goals

- **A schedule that can stop and step.** A written expectation that could break
  at a line and assert what a variable holds there is a real thing to want, and
  it is a change of its own: the schedule vocabulary is described identically to
  every caller, so every caller's description of it moves together.
- **Memory and registers.** No reading or writing an arbitrary address, no CPU
  registers, no disassembling what is in memory. A machine reports which
  addresses a program touched, not what is in them, and that is unchanged.
- **Writing a variable while stopped.** Variables are read. The seam reserves
  room for a write path and implements none, and this change does not open it.
- **Conditional breakpoints, watchpoints, and stopping on a runtime error.**
  A breakpoint is a line number, as it is in the IDE.
- **Stopping anywhere finer than a BASIC line.** The unit is the line the
  program is about to execute, which is the unit every machine that offers this
  can already report.
- **Any change to how a machine is emulated**, to the `Dialect` /
  `MachineEmulator` seam, or to which machines can be stepped. Every member this
  needs is already declared and already implemented; nothing here reaches a
  dialect, an emulator or a bus.
- **The browser IDE.** Its debugger, its gutter, its toolbar and its variable
  watcher are untouched.

## Impact

- **The operations layer** gains four operations, declared once and derived by
  the callers that offer them, with the assistant's absence declared beside them.
  The registry-driven parity check holds both directions, so neither the presence
  nor the reason for an absence can outlive its decision.
- **The interface every operation is written against** gains the members that
  express stopping, stepping and asking where — the first members it has ever had
  that are about a program's position rather than its screen, its keyboard or its
  measurements. Both implementations of it follow, which is what makes the same
  operations answer in the browser and out of it.
- **The loop that advances a held machine** stops being a bare frame advance and
  takes the machine's own stopping path instead — the one the IDE's debugger
  already drives — so there is one account of "run until this line" rather than a
  second one written to match it. A machine nobody has asked to stop keeps taking
  the path it takes today and pays for none of it.
- **What a run answers** gains a way of having ended that it did not have: it
  stopped somewhere and is still there. Every caller that renders a run's outcome
  renders that too.
- **`run`'s input** gains the lines to stop on. This is the first operation input
  that arranges something to happen later in the same request rather than
  describing the work itself.
- **The documentation** gains a page for debugging a program outside the browser,
  beside the pages for watching and playing one.
- No new dependency is expected.
