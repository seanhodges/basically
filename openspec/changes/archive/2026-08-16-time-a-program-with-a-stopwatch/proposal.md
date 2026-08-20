## Why

Knowing which line of a program is slow does not tell the user how long the
program takes. Those are different questions, and the second one is the one a
user asks first: "does this finish in under a second", "is my new version
actually faster", "how long is the gap between these two points". A share of a
run is a proportion; a stopwatch is a duration.

The share is answered by `profile-a-running-program`, which establishes the run
clock this change reads. What is still missing is any way to ask that clock for
an interval — from the start of a program to its end, or between two points the
user chose.

The assistant has the same gap, and more sharply. It can already write a
program, run it and read the screen, but it cannot tell whether the version it
just wrote is faster than the one it replaced. A stopwatch it can operate turns
"this should be faster" into a measured claim.

**Depends on `profile-a-running-program`**, which introduces the run's elapsed
emulated-time clock and the rule that durations are the machine's own time. This
change adds no clock of its own.

## What Changes

- The user can time a whole program: from the moment it starts running to the
  moment it finishes, reported as time on the emulated machine.
- Where a machine cannot tell whether a program is still running, the timing
  ends when the user stops it or when execution pauses, and says which — rather
  than reporting a finish the machine never observed.
- The user can time the interval between two pauses of a debugged run, so the
  cost of a stretch of a program can be measured without timing the whole of it.
- A timing states how it ended: the program finished, it errored, it was still
  going when the user stopped it, or it paused at a breakpoint.
- The assistant can operate the stopwatch as a tool, so it can measure the
  program it wrote and compare two versions rather than assert which is faster.

## Non-goals

- **A new clock.** Elapsed emulated time comes from
  `profile-a-running-program`. If that change has not landed, this one has
  nothing to read.
- **Per-line and per-routine costs**, which are that change's subject.
- **Timing below the BASIC line** — no timing of individual statements, machine
  code, or memory blocks.
- **Timing across runs**: a stopwatch measures one execution. Comparing two
  versions is something the user or the assistant does with two timings, not
  something the stopwatch stores.
- **Retaining timings** beyond the session.
- **Wall-clock timing** of how long the browser took, on the same grounds as the
  profiler.

## Capabilities

### New Capabilities

None. Timing a run is the same capability as measuring one.

### Modified Capabilities

- `profiling`: new requirements for timing an interval — a whole program, or
  between two pauses — and for how a timing ends on a machine that cannot say
  whether a program is still running. The capability is created by
  `profile-a-running-program`; this change adds to it and modifies none of its
  requirements.
- `ai-assistant`: a new requirement in the family covering driving the machine
  and reading the profile — the assistant can time a run and is told how the
  timing ended. Existing requirements are unchanged.

## Impact

- **The run clock**: read, not extended. The elapsed emulated time
  `profile-a-running-program` maintains for a run is what a timing is taken
  from.
- **Run outcome classification** (`src/app/aiRunCheck.ts`): the rules for
  deciding that a program has finished, errored, or is still going already exist
  there and already handle machines that cannot answer whether a program is
  running. A timing's ending is those rules' answer, not a second set.
- **The debug session** (`src/components/EmulatorPane.tsx`): a pause already
  reports the line it stopped on, and `DebugStepOptions` already threads the
  pause origin through every slice. Interval timing marks the clock at each
  pause.
- **The store** (`src/app/store.ts`): holds the current timing and how it ended.
- **The UI**: a timing is shown where the run's other measurements are, and the
  paused-interval timing is shown against the debugger.
- **The assistant** (`src/ai/`): one more tool in the fixed set, offered on the
  same terms as the profile tool, and the per-dialect record of which machines
  can end a timing by observing the program finish.
- **Documentation**: what a timing measures and what each ending means.

The fixed-tool-set rule from `stabilise-the-cached-prefix` governs the new tool,
exactly as it governs the profile tool.
