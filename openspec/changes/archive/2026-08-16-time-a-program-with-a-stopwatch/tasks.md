## 1. Prerequisite

- [x] 1.1 Confirm `profile-a-running-program` has landed and its run-anchored
      elapsed emulated-time clock is available to read. This change adds no
      clock of its own and cannot proceed without it.

## 2. Timing a whole run

- [x] 2.1 Take a timing as the difference between two readings of the profiler's
      run clock, marked when the program starts running and when the timing
      ends. Colocated test.
- [x] 2.2 Derive the ending from the existing run-outcome rules in
      `src/app/aiRunCheck.ts` rather than writing a second judgement of whether
      a program has finished — finished, errored, still running, or paused.
- [x] 2.3 Where the rules cannot observe a finish (a machine without
      `isProgramRunning`), end the timing on the user stopping the run or on a
      pause, and record which. Colocated test covering a machine of each kind.
- [x] 2.4 Test that a timing is never reported as a completion time unless the
      program was observed to finish.
- [x] 2.5 Test that emulated time does not accrue while the debugger is paused,
      so an examined breakpoint is not counted against the program.

## 3. Timing between pauses

- [x] 3.1 Mark the run clock each time the debug session actually pauses, and
      report the interval since the previous pause.
- [x] 3.2 Test that continuing off a line that is itself breakpointed does not
      mark an interval until the run genuinely pauses again — the behaviour
      `DebugStepOptions.fromLine` produces.
- [x] 3.3 Report an interval per step when the user steps line by line.
      Colocated test.

## 4. Store and presentation

- [x] 4.1 Hold the current timing and its ending in `src/app/store.ts`, discarded
      when a new run starts.
- [x] 4.2 Show the whole-run timing where the run's other measurements are
      shown, always with its ending.
- [x] 4.3 Show the interval timing against the debugger, so the cost of the
      stretch just executed is visible at the pause.
- [x] 4.4 State, on a machine that cannot observe a program finishing, that it
      cannot — rather than leaving a timing that never ends unexplained.

## 5. Assistant access

- [x] 5.1 Add the timing tool to the fixed tool set in `src/ai/driveTools.ts`,
      returning the duration and the ending in one answer, and stating in its
      description that a timing costs a run.
- [x] 5.2 Offer it on the same terms as the profile tool — resolved once per
      conversation, never appearing or disappearing with a running machine.
      Colocated test that the offered set is stable across a conversation.
- [x] 5.3 Record per-dialect which machines can end a timing by observing the
      program finish, in `src/ai/machineObservability.ts`, with the crosscheck
      test that constructs every registered machine.
- [x] 5.4 Tell the assistant explicitly when the machine cannot observe a finish,
      rather than returning a bare duration. Colocated test.

## 6. Documentation

- [x] 6.1 Document in `docs/guide/` what a timing measures, what each ending
      means, and that some machines cannot observe a program finishing. Do not
      touch the sidebar config.

## 7. Quality gates

- [x] 7.1 Extend `e2e/profiling/` with a browser check that a timing appears
      with its ending after a run, on one representative machine — reusing the
      journey the profiler change established rather than a cold page load.
- [x] 7.2 `npm run typecheck`
- [x] 7.3 `npm test`
- [x] 7.4 `npm run lint`
- [x] 7.5 `npm run format:check` (or `npm run format`)
- [x] 7.6 `npm run docs:build` (docs/ changed in task 6.1)
- [x] 7.7 `npm run e2e:chromium -- e2e/profiling`
- [x] 7.8 `npm run e2e:chromium -- e2e/program-execution` — the debug session and
      run loop changed. Check off only on a passing run; note what failed
      otherwise.
- [x] 7.9 `npm run e2e:chromium -- e2e/ai-assistant` — the tool set changed.
      Same rule.
