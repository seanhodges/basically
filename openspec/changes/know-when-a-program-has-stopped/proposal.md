## Why

Three parts of the IDE wait for the same signal, and on five machines it never
arrives.

The profiler's stopwatch never settles, so a timing runs on while the machine
sits at its prompt and has to be labelled with an ending the user did not
choose. The assistant is told a program "ran without failing" when it could have
been told the program finished. And the round run control over the editor goes
on offering Pause after the program has ended, because nothing reported an end —
so the one button that should always come back to Play does not.

Each of those has been given its own careful hedge, and the hedges are the
problem: they exist only to describe machines that cannot answer a question the
IDE needs answered. `MachineEmulator.isProgramRunning()` is optional today, and
the ZX80, ZX81, both Spectrums and the Atom omit it, on the documented grounds
that their ROMs leave no system variable separating a running program from a
finished one.

That reasoning is sound and remains true — but it looked for the wrong kind of
signal. Whether a program is running is a *state* only on machines that happen
to keep a cell for it. On the machines that do not, stopping is an *event*: the
ROM takes a branch, once, at the moment it gives up on the program and returns
to its command loop. Every one of these five machines is emulated instruction by
instruction, and four of them already trap ROM addresses for tape load and save,
so that event is observable with a single integer compare on a path the CPU
already runs.

Booting the real ROMs and tracing them confirms it: each machine has one
address, reached exactly once per termination, and reached by no program that is
still running — including one waiting at an `INPUT` prompt, which is what defeats
every screen, cursor or keyboard-scan heuristic.

## What Changes

- Every machine reports whether a BASIC program is executing. The seam member
  stops being optional, and gains a stated obligation: a machine must eventually
  answer, rather than answering "not yet" forever.
- The five machines that cannot answer today learn to, by observing the moment
  their ROM stops running the program rather than by polling a cell that does
  not exist.
- A timing always reaches an ending. The ending "the machine cannot observe a
  finish" is retired, along with the surface that explained it to the user.
- The assistant is told that a program finished, on every machine, rather than
  the weaker "it raised no failure" on some of them.
- The run control returns to Play whenever the program ends, on every machine.
- Every registered machine is held to the same behaviour by one shared test, so
  a machine added later cannot quietly reintroduce the gap.

## Non-goals

- **Line-level debugging for the machines that lack it.** Whether a program is
  running and which line it is on are independent questions: this change gives
  the Atom the first without giving it the second, and adds no debugger,
  breakpoint or per-line cost anywhere.
- **Changing what a program does.** Detection observes the ROM; it never patches
  it, never appends a sentinel line, and never alters the program the user
  wrote. A measured run executes the same instructions as an unmeasured one.
- **Reporting *why* a program stopped.** That is the runtime report's job and it
  already exists; this change reports only that the program is no longer
  running.
- **Tracking a program the user starts by typing `RUN` on the emulated
  keyboard.** The reported state describes the run the IDE started. See the
  design for why, and for what the machines that poll a cell do differently.
- **Retiring the runtime report as an end signal.** An error still ends a run
  immediately, on the same terms as today.

## Capabilities

### New Capabilities

None. Reporting run state is part of the runtime state the IDE already surfaces.

### Modified Capabilities

- `program-execution`: a new requirement that every machine reports whether a
  program is executing, and a modification to the run control requirement to
  drop the case where a machine never observes an end.
- `profiling`: the requirement covering machines that cannot observe a finish is
  removed, and replaced by the guarantee that a timing always reaches an ending.
- `ai-assistant`: the outcome reported for a run the IDE checks no longer varies
  by whether the machine can tell a finished program from a running one.

**Sequenced after `pause-and-continue-a-run` and
`time-a-program-with-a-stopwatch`**, which introduce the run control and the
timing requirements this change amends. Both are implemented; this change edits
what they established rather than restating it.

## Impact

- **The seam** (`src/dialects/types.ts`): `isProgramRunning()` becomes required,
  and its contract gains the obligation to answer. This is the one breaking
  change to the `MachineEmulator` interface, and every registered machine is
  updated in this change.
- **Five machines** (`src/dialects/zx80/`, `zx81/`, `zxspectrum/`,
  `zxspectrum128/`, `src/emulator/atom/`): each gains a run-state latch driven
  by a ROM address observed on the step it already runs.
- **Run outcome classification** (`src/app/aiRunCheck.ts`): the fourth state of
  `AiRunFrame.running` — "this machine can never answer" — is removed, along
  with the branches that existed for it.
- **Run timing** (`src/app/runTiming.ts`): the special case that reads the
  runtime report every frame on machines with no other end signal is removed,
  and `observesFinish` with it.
- **The run control** (`src/app/runControl.ts`): the case where an ended program
  is never reported disappears.
- **The assistant's machine tables** (`src/ai/machineObservability.ts`):
  `DIALECTS_WITHOUT_FINISH_OBSERVATION` and its accessor are deleted; the
  crosscheck test that pins the table against the real machines is retargeted at
  the new guarantee.
- **A shared conformance test**: one registry-driven test boots every registered
  machine and holds it to the contract, replacing the five per-machine traces
  that check the same thing today.
- **Documentation**: `docs/contributing/architecture.md` records the run-state
  signal alongside the other introspection members, and the note that the
  Sinclair machines cannot observe a finish is removed.
