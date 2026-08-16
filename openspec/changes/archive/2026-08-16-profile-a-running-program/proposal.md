## Why

The IDE runs a program authentically but can say nothing about how it performs.
A user who finds their game too slow, or watches it freeze for a second every
so often, has no way to ask the machine where the time went - they can only
guess, edit, and run it again. The freeze in particular is the classic
Commodore BASIC garbage collection pause, and nothing in the IDE makes it
visible.

Everything needed to answer is already inside the running machine and unused:
the machines report the BASIC line they are executing, most of them report
their own RAM figures, and the emulators count cycles because they must.
What is missing is somewhere for those numbers to go.

## What Changes

- A run records where its time went, line by line, and how much RAM it was
  using as it went. Recording happens on every ordinary run, so there is no
  profiling mode to remember to switch on and no run that turns out not to have
  been measured.
- The editor shows each line's share of the run's time beside the line itself,
  so the slow line is found by looking at the program rather than by reading a
  report elsewhere.
- The IDE reports the run's memory use over time, not just its latest figure,
  so a program that grows, or that stalls while BASIC reclaims its strings, can
  be seen doing it.
- Times are reported as time on the emulated machine - what the program would
  take on the hardware - not as time in the browser. A user running at 4x speed
  and a user running at 1x get the same numbers.
- The assistant can ask for the profile when it needs it, and use it to explain
  or improve a program's speed.
- Machines that cannot report the line they are executing, or cannot report
  their RAM, offer correspondingly less rather than offering a guess.

## Non-goals

- **Host performance.** How fast the browser emulates a machine is a
  development concern, not a user-facing one, and is not reported.
- **Attributing a line's cost to its caller.** Time is charged to the line
  executing it, so a subroutine's cost lands on the subroutine. Inclusive costs
  would need each machine's own GOSUB stack read separately, and are left out.
- **Statement-level attribution.** A line holding several statements is
  measured as one line, because the line is what the machines report.
- **Stopwatch timing** - timing a whole program to completion, or the interval
  between breakpoints - which is a separate change built on this one's clock.
- **Profiling machine code**, blocks, or anything below the BASIC line.
- **Retaining a profile** beyond the session or across a program change.

## Capabilities

### New Capabilities

- `profiling`: where a running program's time and memory go - what the IDE
  measures during a run, how a line's share of the time is shown against the
  program, how memory use over the run is reported, and what a machine that
  cannot be measured offers instead.

### Modified Capabilities

- `ai-assistant`: a new requirement in the family that already covers driving
  the machine and reading its screen - the assistant can ask for the profile of
  the program it is working on, and is told whether the machine can produce
  one. Existing requirements are unchanged.

## Impact

- **The machine seam** (`src/dialects/types.ts`): a new optional pair on
  `MachineEmulator` for arming profile recording and draining what was
  recorded, alongside the existing optional introspection members. Optional in
  the same way and detected the same way, so machines that cannot answer are
  unaffected.
- **The machines**: each machine that can be profiled accumulates the cost
  against the BASIC line it is executing. This touches the step each machine
  already runs, which is shared by ordinary runs and debugger slices alike.
- **The run loop** (`src/components/EmulatorPane.tsx`): arms recording for a
  run, drains it, and samples the machine's RAM figures on a run-anchored
  cadence.
- **The store** (`src/app/store.ts`): holds the profile for the buffer that
  produced it.
- **The editor** (`src/components/CodeMirrorHost.tsx`): the per-line share is
  drawn in the gutter that already carries lint and breakpoint markers, so the
  three have to agree about precedence.
- **The assistant** (`src/ai/`): one more tool in the fixed set, plus the
  per-dialect record of which machines can answer it.
- **Documentation**: a user-facing account of what the profile measures, and
  of the fact that costs are charged flat.

The in-flight `stabilise-the-cached-prefix` change governs how tools may be
offered: the set must be fixed for a conversation rather than appearing when a
machine happens to be running. This change is written to that rule.
