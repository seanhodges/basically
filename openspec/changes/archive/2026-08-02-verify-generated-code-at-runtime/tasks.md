## 0. The run-state question on the machine seam

- [x] 0.1 Add the optional `isProgramRunning(): boolean | null` member to
      `MachineEmulator` in `src/dialects/types.ts`, documenting the three states
      (executing / at the prompt / not answerable yet) and that a machine which
      cannot tell simply omits it, detected via `typeof`.
- [x] 0.2 Implement it on the BBC (`src/emulator/bbc/bbcMachine.ts`) from
      `currentLine()`, `null` while not initialised, injecting or disposed.
- [x] 0.3 Implement it on the CPC (`src/emulator/cpc/cpcMachine.ts`) from
      `currentLine()`, whose pointer the firmware zeroes at the Ready prompt.
- [x] 0.4 Implement it on the TRS-80
      (`src/dialects/trs80/interpreter/machine.ts`) from the interpreter's own
      execution state.
- [x] 0.5 Implement it on the Commodore machines (C64, VIC-20, PET) from the
      editor's cursor-blink flag — `$CC` on the V2 machines, `$A7` on BASIC 4.0
      — added beside the other shared zero-page addresses in
      `src/emulator/commodore/basicPointers.ts`; `null` while not booted,
      injecting or disposed.
- [x] 0.6 Leave the Sinclair machines without it, with a comment recording why
      (`PPC` keeps the last line after a program stops, and no system variable
      stably separates running from finished).
- [x] 0.7 Pin each implementation with a colocated test against the real ROM: a
      looping program reads as running, a finished one reads as not running, and
      neither reads as finished before the machine has taken the program.

## 1. The outcome model

- [x] 1.1 Define the run-outcome shape (`errored` carrying the `MachineReport`,
      `ended-ok`, `still-running`, `never-started`) alongside the existing AI-run
      state in `src/app/store.ts`, replacing the error-only `runReport`.
- [x] 1.2 Extract the frame-by-frame classification into a pure, exported helper
      that takes the current `readReport()` result, the current run-state answer
      (or its absence) and the running/absolute frame counts, and returns either
      "keep watching" or a terminal outcome. Keep it out of the component so it
      is testable without a canvas.
- [x] 1.3 Add a colocated test pinning the classifier: an error report yields
      `errored` with the report; a machine reporting no program running yields
      `ended-ok`; an unanswerable run state never advances the running-frame
      count; the running window expiring yields `still-running`; the absolute cap
      with the machine never up yields `never-started`; and a machine that
      cannot answer the run state never yields `ended-ok`.

## 2. Producing the outcome

- [x] 2.1 Rewrite the AI check block in `src/components/EmulatorPane.tsx` to call
      the classifier and report every terminal outcome, not only the first error.
      Preserve the existing `AI_CHECK_MAX_FRAMES` / `AI_CHECK_ABS_MAX_FRAMES`
      windows and the "only count frames where the machine is up" rule.
- [x] 2.2 Keep the `typeof machine.readReport === 'function'` guard so machines
      that cannot introspect their error state arm no check and report no
      outcome.
- [x] 2.3 Correct the stale comment claiming the check is armed only by
      "Replace + Run" — `applyText` is shared by both apply-and-run actions, so a
      merged fragment arms it too.

## 3. The bounded automatic correction

- [x] 3.1 In `src/ai/aiStore.ts`, add the attempt counter for unrequested
      corrections: bounded at two, scoped to the run being corrected, released
      when the user sends a new request.
- [x] 3.2 Extend the module-level IDE-store subscription to act on the new
      outcome. On `errored` within the bound, send the correction automatically
      using `buildRunFix(source, report)` — the same content the manual banner
      sends — following the empty-reply retry's history shape (synthetic
      assistant turn plus follow-up user turn, re-run through `runAttempt`).
- [x] 3.3 On `errored` at the bound, fall back to today's behaviour: raise the
      `pendingFix` banner and reveal the panel.
- [x] 3.4 Suppress the automatic correction when the program has changed since
      the reply it was written against, reusing the existing source-fingerprint
      staleness check.
- [x] 3.5 Feed the non-failing outcomes (`ended-ok`, `still-running`,
      `never-started`) back to the conversation without triggering a correction.
- [x] 3.6 Add tests to `src/ai/aiStore.test.ts`: an error inside the bound sends
      a correction unasked; the bound stops further attempts and raises the
      banner instead; a new user request releases the bound; a stale program
      suppresses the correction; a non-failing outcome corrects nothing.

## 4. Panel affordances

- [x] 4.1 Show an automatic correction as in progress in
      `src/components/AiPanel.tsx`, reusing the existing busy/`retrying`
      affordances rather than adding a new one.
- [x] 4.2 Confirm the existing Stop cancels an automatic correction and leaves no
      further attempt queued.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check` (or `npm run format`)
- [x] 5.5 `npm run e2e:chromium -- e2e/ai-assistant` — covers the apply-and-run
      actions this change alters. Check off only when the run passes; on failure
      leave unchecked and note what failed.
- [x] 5.6 `npm run e2e:chromium -- e2e/program-execution` — the run path shares
      the frame loop being edited. Same rule: check off only on a passing run.
- [x] 5.7 `npx openspec validate --changes`
- [ ] 5.8 Manual check on a machine that reports its error state: ask for a
      program that fails at runtime, confirm the assistant corrects it unasked,
      keeps failing to the bound, then offers the banner. Repeat on a machine
      that cannot report (ZX80 or Atom) and confirm nothing changes for it.
