## 1. The measurement seam

- [x] 1.1 Add the profile cost types to `src/dialects/types.ts`: a per-line cost
      entry carrying the line number, the accumulated cost and the unit that
      cost is counted in (cycles, or frames where a machine has no cycles).
- [x] 1.2 Add `setProfileRecording?(enabled: boolean)` and `drainProfile?()` to
      `MachineEmulator`, documenting the same contract
      `setMemoryActivityRecording` / `drainMemoryActivity` carry: off by
      default, a not-taken branch on the hot path when off, drained by whoever
      armed it, null when recording is off.
- [x] 1.3 Write the shared accumulator the machines use to hold line costs
      between drains, with colocated tests for accumulation, drain-and-reset,
      and the disabled case costing nothing.

## 2. Instrument the machines

Each machine accumulates against the BASIC line it is executing inside the step
function `runFrame` and `debugStep` both funnel through — never inside
`debugStep` itself. Sample on the cadence that machine's debugger already
justifies. Read the executing line through the unwrapped bus where the machine
wraps its bus for memory-activity recording.

- [x] 2.1 ZX81 — instrument `stepInstruction()`; colocated test booting the real
      ROM asserts a known loop's cycles land on the expected line.
- [x] 2.2 ZX80 — same, with its own colocated test.
- [x] 2.3 ZX Spectrum and Spectrum 128 — same, with colocated tests.
- [x] 2.4 C64 — instrument `tickOnce()`, reusing `DEBUG_SLICE_CYCLES` as the
      sample cadence and `rawCpuRead` for the line read; colocated test.
- [x] 2.5 PET and VIC-20 — same, with colocated tests.
- [x] 2.6 BBC — same, with a colocated test.
- [x] 2.7 CPC — same, with a colocated test.
- [x] 2.8 TRS-80 interpreter — accumulate in frames rather than cycles, since it
      executes statements and has no cycle budget; colocated test asserts the
      unit it reports.
- [x] 2.9 Registry-driven test pinning which registered machines report per-line
      costs and which report memory figures, constructing every registered
      machine rather than asserting a written-down list (pattern:
      `src/dialects/graphicsPalette.test.ts`).
- [x] 2.10 Test that a measured run and an unmeasured run of the same program
      advance the machine identically — same emulated time, same screen.

## 3. Recording and sampling in the run loop

- [x] 3.1 Arm profile recording in `src/components/EmulatorPane.tsx` when a
      machine starts, disarm when it goes away; drain per frame on both the
      `runFrame` path and the `debugStep` path.
- [x] 3.2 Sample `readMemoryStats()` into a run-anchored series keyed by the
      run's own emulated time, on a frame cadence, replacing nothing about the
      existing 500 ms status-bar poll.
- [x] 3.3 Bound the series so a long run cannot grow it without limit, keeping
      the peak used across the whole run even once the retained record no longer
      covers it, and flagging that the record is partial. Colocated test.
- [x] 3.4 Reset both the costs and the memory series when a run starts, so
      figures never accumulate across runs.

## 4. Store and derived reporting

- [x] 4.1 Hold the profile in `src/app/store.ts` against the buffer that
      produced it, following how breakpoints are held per buffer.
- [x] 4.2 Discard per-line costs when the program is edited such that its lines
      no longer correspond to the measured ones. Colocated test.
- [x] 4.3 Derive each line's share of the run's total as a unit-free proportion,
      so the display is identical whether the machine counted cycles or frames.
      Colocated test covering both units.
- [x] 4.4 Roll line costs up over the routines and jump destinations
      `src/editor/programOutline.ts` already extracts. Colocated test.

## 5. The editor heat map

- [x] 5.1 Extend the combined gutter in `src/components/CodeMirrorHost.tsx` to
      draw each line's share alongside the lint and breakpoint markers, deciding
      and documenting precedence so neither marker is hidden.
- [x] 5.2 Reconfigure the gutter from the store when the profile changes, via a
      compartment, the way the breakpoint set already does.
- [x] 5.3 Leave lines that consumed no measured time unmarked, distinct from
      lines that ran cheaply. Colocated test.
- [x] 5.4 Show the profile of the buffer on screen only, so one buffer's costs
      are never drawn against another's lines. Colocated test.
- [x] 5.5 State in the UI that a line's cost excludes the routines it calls, and
      that durations are the machine's own time rather than elapsed browser
      time.

## 6. Memory over the run

- [x] 6.1 Present the memory series against the run's elapsed machine time, with
      the peak used, in a surface that also reports total fitted BASIC RAM.
- [x] 6.2 Report an unavailable memory account as unavailable on machines
      without `readMemoryStats()`, rather than as zeroes. Colocated test.

## 7. Assistant access

- [x] 7.1 Add the profile tool to the fixed tool set in `src/ai/driveTools.ts`,
      returning the hottest lines, the routine rollup and the memory summary,
      and stating that costs exclude called routines.
- [x] 7.2 Offer the tool on the same terms as `drive` and `look` — resolved once
      per conversation, never appearing or disappearing according to whether a
      machine is running (the rule `stabilise-the-cached-prefix` establishes).
      Colocated test that the offered set does not change across a conversation.
- [x] 7.3 Record which dialects can produce measurements in
      `src/ai/machineObservability.ts`, alongside
      `DIALECTS_WITHOUT_VARIABLE_READBACK`, with the crosscheck test that
      constructs every registered machine and fails when the table drifts.
- [x] 7.4 Answer the tool with an explicit "nothing measured yet" rather than an
      empty result when no run has happened. Colocated test.

## 8. Documentation

- [ ] 8.1 Document in `docs/guide/` what the profile measures, that its
      durations are the emulated machine's own time, and that a line's cost
      excludes the routines it calls. Do not touch the sidebar config.

## 9. Quality gates

- [ ] 9.1 Add `e2e/profiling/` with at least one browser smoke test — the gutter
      actually painting heat after a run, and the memory account rendering — on
      one representative machine, extending an existing journey where possible.
      `src/e2eCapabilityLayout.test.ts` requires the folder to exist for the new
      capability.
- [ ] 9.2 Measure the always-on recording cost on the slowest core and record
      the result. If it is not negligible, fall back to arming recording per run
      rather than for the machine's whole life.
- [ ] 9.3 `npm run typecheck`
- [ ] 9.4 `npm test`
- [ ] 9.5 `npm run lint`
- [ ] 9.6 `npm run format:check` (or `npm run format`)
- [ ] 9.7 `npm run docs:build` (docs/ changed in task 8.1)
- [ ] 9.8 `npm run e2e:chromium -- e2e/profiling`
- [ ] 9.9 `npm run e2e:chromium -- e2e/program-execution` and
      `npm run e2e:chromium -- e2e/code-editor` — the run loop and the editor
      gutter both changed. Check off only on a passing run; note what failed
      otherwise.
- [ ] 9.10 `npm run e2e:chromium -- e2e/ai-assistant` — the tool set changed.
      Same rule.
