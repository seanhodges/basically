## Why

Every machine adapter hand-rolls the same execution scaffolding: the
`debugStep` body (breakpoint arming, budget walk, line watch) is
copy-pasted across ten machines, cycle-debt accounting across eight, and a
`runCycles(budget)` loop across six. The invariant that a debug slice does
everything a frame does is enforced only by `debugEquivalence.test.ts` and
prose in `docs/contributing/architecture.md` — and its violation shipped
three real bugs (blank PMD 85 profiler, BBC/Atom audio backlog, frozen PMD
85 blink) that had to be patched machine-by-machine. A shared loop makes
the invariant structural: the next machine cannot get it wrong.

## What Changes

- New `src/emulator/machineLoop.ts`: a composition helper (not a base
  class) owning `runFrame()` and `debugStep(opts)` over a machine-supplied
  contract — roughly `{ cyclesPerFrame, step(): number,
  currentLine(): number | null, onSlice?(…) }` — including cycle-debt
  carry-over, breakpoint arming, and the guarantee that per-frame side
  effects (frame counter, profiler charge, recorder draining hooks) run
  identically on both paths.
- Migrate the machine adapters that currently duplicate this scaffolding
  (the Z80 family, the Commodore family, cpc, bbc/atom, pmd85/altair) onto
  the helper, one emulator wiring family at a time, deleting the ten copies
  of the `debugStep` body.
- `docs/contributing/architecture.md` stops prescribing "one step function
  both paths call" as a convention and instead points at the helper.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — pure refactor. The observable contract ("debugging a run does not
change it") is already specified in `openspec/specs/program-execution/spec.md`
and is unchanged; `src/dialects/debugEquivalence.test.ts` and
`src/dialects/lineProfiling.test.ts` remain the proof and must stay green
at every migration step.

## Non-goals

- No abstract `MachineEmulator` base class — buses, video, and I/O
  genuinely differ, and the vendored cores (jsbeeb, viciious) must not be
  forced into a hierarchy.
- No behaviour changes to any machine's timing, audio, or profiling; a
  migration step that needs a tolerance loosened in `debugEquivalence` is a
  bug in the migration, not in the test.
- No changes to the vendored cores: `src/emulator/z80/`,
  `src/emulator/6502/cpu6502.js`, `src/emulator/c64/viciious/`, and the
  jsbeeb package are untouched.

## Impact

- New `src/emulator/machineLoop.ts` + colocated test.
- Machine adapters: `src/dialects/{zx80,zx81,zxspectrum,zxspectrum128,pmd85,altair8800}/emulator/*Machine.ts`,
  `src/emulator/{bbc,atom,cpc,c64,pet,vic20}/…Machine.ts` — each loses its
  copied loop, keeps its machine-specific bus/video work.
- `docs/contributing/architecture.md` (developer docs only).
- Safety net: existing registry-driven batteries (`debugEquivalence`,
  `lineProfiling`, `profileTransparency`, `frameRate`) plus each machine's
  colocated tests.
