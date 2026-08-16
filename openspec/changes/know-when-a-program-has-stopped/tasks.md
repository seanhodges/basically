## 1. Sequencing

- [ ] 1.1 Confirm `pause-and-continue-a-run` and
      `time-a-program-with-a-stopwatch` are implemented, since this change edits
      the run control and the timing requirements they establish.

## 2. Teach the five machines to answer

Each machine gets a run-state latch: armed in `loadProgram`, set when the ROM
reaches the address at which it stops running a program, read by
`isProgramRunning()`. Every address below was derived by booting the committed
ROM and tracing it; each task pins its address with a colocated test that
reproduces the trace, rather than asserting the constant.

- [ ] 2.1 **ZX81** (`src/dialects/zx81/emulator/zx81Machine.ts`): latch on
      `0x06AE`, compared in `stepInstruction()` beside the existing LOAD/SAVE
      traps. Arm anywhere in `loadProgram` — this ROM's LOAD auto-runs through
      `NXTLIN` and never reaches the address first. Name the address in
      `sysvars.ts` alongside the other ROM entry points. Colocated test covering:
      falls off the end, `STOP`, an error, `GOSUB`/`RETURN`, BREAK, a program
      that fills the screen, and — reporting *running* — an idle loop, an
      `INKEY$` loop, `PAUSE`, and an `INPUT` prompt.
- [ ] 2.2 **ZX80** (`src/dialects/zx80/emulator/zx80Machine.ts`): the same
      treatment on `0x0488`, the BREAK test that falls into the report printer.
      Same test battery, in this dialect's terms. This machine has no
      `readReport()` either, so it currently has no end signal of any kind.
- [ ] 2.3 **ZX Spectrum 48K**
      (`src/dialects/zxspectrum/emulator/spectrumMachine.ts`): latch on
      `0x1303`. Arm immediately after `loadProgram` submits its `RUN`, **not** by
      counting hits — the machine types an extra `CLEAR` when the document has a
      memory block below RAMTOP, so the number of prior command lines varies with
      the document. Test the battery above plus: a document with a block, and
      BREAK (CAPS SHIFT + SPACE) both out of a loop and during `INPUT`, which
      must go on reporting running.
- [ ] 2.4 **ZX Spectrum 128K**: probe first. `0x1303` is expected to be the right
      offset since 48 BASIC runs unchanged in ROM 1, but the address is only
      meaningful when ROM 1 is paged in — trace the machine and record whether the
      `0x7FFD` ROM-select bit must qualify the compare.
- [ ] 2.5 **ZX Spectrum 128K** (`spectrum128Machine.ts`): implement what 2.4
      found, qualifying the address by the paged-in ROM if required. Same test
      battery. If 2.4 shows the address cannot be made reliable, stop and revisit
      the proposal before group 5 — the deletions there assume every machine
      answers.
- [ ] 2.6 **Acorn Atom** (`src/emulator/atom/atomMachine.ts`): latch on
      `0xC2CF`, compared inside the `debugInstruction` hook the machine already
      registers. Arm after `typeViaMatrix('RUN\r')`; the baseline is always one
      prior hit (the boot prompt) because blocks are poked rather than typed.
      This machine has no `currentLine()`, so `true` runs from arming until the
      address is seen — see the design. Test battery must include ESCAPE, both
      out of a loop and during `INPUT`: the obvious candidate address for this
      machine misses ESCAPE entirely, and only the command-loop entry covers it.

## 3. Hold every machine to the contract

- [ ] 3.1 Extend `MachineEmulator.isProgramRunning()`'s documented contract with
      the obligation to reach a definite answer within a bounded time, and with
      which of the two readings a machine provides — the machine's state, or the
      run the IDE started (see the design).
- [ ] 3.2 Add one registry-driven conformance test that boots every registered
      machine, runs a program that terminates, and asserts the sequence: never
      `false` before the program has started, `true` while it runs, `false`
      within a bounded number of frames of it ending. Follow the pattern of
      `e2e/paletteMachines.ts` + `src/dialects/graphicsPalette.test.ts`.
- [ ] 3.3 Add the companion case to the same test: a program that loops forever
      is still reported as running at the end of the window.
- [ ] 3.4 Retire the five per-machine `isProgramRunning` traces that the shared
      test now covers (PET, VIC-20, C64, BBC, CPC), keeping any assertion that is
      genuinely machine-specific.

## 4. Make the seam member required

- [ ] 4.1 Drop the `?` from `isProgramRunning` in `src/dialects/types.ts` and
      update the doc comment: remove the paragraph about machines whose ROM
      leaves no reliable trace, and the `typeof` capability-detection note.
- [ ] 4.2 Remove the `undefined` case from `AiRunFrame.running` in
      `src/app/aiRunCheck.ts` — the state meaning "this machine can never
      answer" — and the branches that existed for it in `immediateRunOutcome`
      and `classifyAiRunFrame`. Update the colocated tests.
- [ ] 4.3 Simplify `timingFrame()` in `src/app/runTiming.ts`: every machine now
      answers, so the special case that reads the runtime report every frame for
      machines with no other end signal goes.

## 5. Remove the surfaces that described the gap

Depends on group 2 completing for every machine, including 2.5.

- [ ] 5.1 Delete `DIALECTS_WITHOUT_FINISH_OBSERVATION` and
      `canObserveProgramFinish` from `src/ai/machineObservability.ts`, and
      retarget the crosscheck test in `machineObservability.test.ts` at the new
      guarantee: every registered machine implements the member.
- [ ] 5.2 Remove `RunTiming.observesFinish` and every surface that reads it, so
      no timing is presented with an explanation of why it might never end.
- [ ] 5.3 Remove the `programEnded` special case in `src/app/runControl.ts` for
      machines that never report an end, and its colocated test.
- [ ] 5.4 Update `docs/contributing/architecture.md`: record run state alongside
      the other introspection members, and remove the note that the Sinclair
      machines cannot observe a finish.
- [ ] 5.5 Check the user-facing docs under `docs/guide/` and `docs/reference/`
      for any statement that a machine cannot tell a finished program from a
      running one, and remove what is no longer true.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck`
- [ ] 6.2 `npm test`
- [ ] 6.3 `npm run lint`
- [ ] 6.4 `npm run format:check`
- [ ] 6.5 `npm run docs:build` (docs change in 5.4/5.5)
- [ ] 6.6 `npm run e2e:chromium -- e2e/program-execution`
- [ ] 6.7 `npm run e2e:chromium -- e2e/profiling` — the journey in
      `heat-and-memory.spec.ts` notes that the ZX81 can never show a settled
      timing; that note and the machine it picks should be revisited now the
      ZX81 can.
- [ ] 6.8 `npm run e2e:chromium -- e2e/ai-assistant`
