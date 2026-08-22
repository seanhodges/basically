## Context

Every machine adapter implements `MachineEmulator` from scratch. The
recorders are shared (`src/emulator/memoryActivityBuffer.ts`,
`lineCostRecorder.ts`, `programEndLatch.ts`) but the loop that drives them
is not: ten adapters carry a near-identical `debugStep` body (breakpoint
arming via `let armed = opts.fromLine === null`, budget walk, line watch),
eight carry the same cycle-debt field, six the same `runCycles(budget)`.
The invariant that a debug slice is a frame — everything `runFrame` does
around the CPU work must happen in a slice too, because for every
`debuggable` dialect the debug path *is* the normal Play path — is pinned
by `src/dialects/debugEquivalence.test.ts` and described in
`docs/contributing/architecture.md`, but structurally each machine
re-implements it. Three shipped bugs (silent profiler, audio backlog on the
Acorns, a frozen blink) were all instances of the two paths drifting.

## Goals / Non-Goals

**Goals:**

- One implementation of the frame/slice loop that makes path parity
  structural: a machine supplies its stepper and its per-slice work once,
  and both `runFrame` and `debugStep` are generated from them.
- Byte-identical observable behaviour per machine: cycles, audio,
  profiling, frame counters, and `debugEquivalence` tolerances unchanged.

**Non-Goals:**

- No abstract base class over `MachineEmulator` and no changes to the
  Dialect/MachineEmulator seam (`src/dialects/types.ts`): the helper is
  private plumbing inside each adapter; the seam's surface and semantics
  are untouched.
- No changes to vendored cores (`src/emulator/z80/`,
  `src/emulator/6502/cpu6502.js`, `src/emulator/c64/viciious/`, jsbeeb).
- No new capabilities (e.g. no new steppers for machines that lack one).

## Decisions

- **A factory, not a superclass.** `createMachineLoop(contract)` in
  `src/emulator/machineLoop.ts` returns `{ runFrame, debugStep }` that the
  adapter exposes as its own methods. Composition keeps the vendored-core
  adapters (jsbeeb, viciious) free to wrap their cores however those cores
  demand, and avoids inheritance across `src/dialects/<name>/emulator/`
  and `src/emulator/<name>/` folder layouts. Alternative considered: an
  abstract `BaseMachine` — rejected; the buses/video/IO genuinely differ
  and a hierarchy would fight the two vendored cores' own shapes.
- **The contract is the machine's step plus hooks.** Roughly:
  `cyclesPerFrame`, `step(): number` (one instruction, returns cycles — the
  `stepInstruction()`/`tickOnce()` seam `architecture.md` already
  prescribes), `currentLine(): number | null` (for breakpoint arming),
  and an `onSlice(cycles)` hook where a machine does its per-frame side
  effects exactly once per slice (frame counter, sound catch-up
  scheduling, profiler bookkeeping that isn't already charged in `step`).
  Cycle debt lives in the helper.
- **Migrate family by family, equivalence-gated.** Order: the
  self-contained Z80 machines (zx80, zx81, zxspectrum, zxspectrum128),
  then pmd85/altair8800 (i8080 over the Z80 core), then the Commodores
  (pet, vic20, c64), then cpc, then bbc/atom (jsbeeb). After each family,
  the full suite — in particular `debugEquivalence.test.ts`,
  `lineProfiling.test.ts`, `profileTransparency.test.ts`,
  `frameRate.test.ts`, and the machines' colocated tests — must pass with
  no tolerance changes. Each family is a separately revertable commit.
- **The helper is tested once, directly.** A colocated
  `machineLoop.test.ts` covers debt carry-over, breakpoint arming from a
  given line, budget exhaustion mid-instruction, and the guarantee that
  `onSlice` fires exactly once per `runFrame` and per `debugStep`. The
  registry batteries then prove each migration, rather than each machine
  re-testing loop mechanics.

## Risks / Trade-offs

- [A machine has a real, load-bearing deviation the copy-paste hid] → The
  migration will surface it as a `debugEquivalence`/colocated-test failure;
  handle it as an explicit contract hook (or, if it is a bug like the three
  known ones were, fix it and note it) — never by loosening a tolerance.
- [The jsbeeb/viciious adapters step in core-defined units, not single
  instructions] → The contract takes "one step, returns cycles"; a wrapped
  core's smallest honest step unit satisfies it (this is what their
  `tickOnce()` already is). If a core cannot express that, the machine
  keeps its hand-written loop and is documented as such in the module —
  partial adoption is acceptable and still removes the other copies.
- [Refactor churn across 12+ adapters] → Family-by-family commits, each
  independently green and revertable.

## Migration Plan

One family per commit as ordered above; `docs/contributing/architecture.md`
is updated in the final commit to point at the helper instead of
prescribing the convention in prose. Rollback is per-family revert; no data
or storage migration is involved.
