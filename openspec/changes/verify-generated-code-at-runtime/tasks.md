## 1. The outcome model

- [ ] 1.1 Define the run-outcome shape (`errored` carrying the `MachineReport`,
      `ended-ok`, `still-running`, `never-started`) alongside the existing AI-run
      state in `src/app/store.ts`, replacing the error-only `runReport`.
- [ ] 1.2 Extract the frame-by-frame classification into a pure, exported helper
      that takes the current `readReport()` result plus the running/absolute
      frame counts and returns either "keep watching" or a terminal outcome. Keep
      it out of the component so it is testable without a canvas.
- [ ] 1.3 Add a colocated test pinning the classifier: an error report yields
      `errored` with the report; a non-error report yields `ended-ok`; a null
      report never advances the running-frame count; the running window expiring
      with the machine up yields `still-running`; the absolute cap with the
      machine never up yields `never-started`.

## 2. Producing the outcome

- [ ] 2.1 Rewrite the AI check block in `src/components/EmulatorPane.tsx` to call
      the classifier and report every terminal outcome, not only the first error.
      Preserve the existing `AI_CHECK_MAX_FRAMES` / `AI_CHECK_ABS_MAX_FRAMES`
      windows and the "only count frames where the machine is up" rule.
- [ ] 2.2 Keep the `typeof machine.readReport === 'function'` guard so machines
      that cannot introspect their error state arm no check and report no
      outcome.
- [ ] 2.3 Correct the stale comment claiming the check is armed only by
      "Replace + Run" — `applyText` is shared by both apply-and-run actions, so a
      merged fragment arms it too.

## 3. The bounded automatic correction

- [ ] 3.1 In `src/ai/aiStore.ts`, add the attempt counter for unrequested
      corrections: bounded at two, scoped to the run being corrected, released
      when the user sends a new request.
- [ ] 3.2 Extend the module-level IDE-store subscription to act on the new
      outcome. On `errored` within the bound, send the correction automatically
      using `buildRunFix(source, report)` — the same content the manual banner
      sends — following the empty-reply retry's history shape (synthetic
      assistant turn plus follow-up user turn, re-run through `runAttempt`).
- [ ] 3.3 On `errored` at the bound, fall back to today's behaviour: raise the
      `pendingFix` banner and reveal the panel.
- [ ] 3.4 Suppress the automatic correction when the program has changed since
      the reply it was written against, reusing the existing source-fingerprint
      staleness check.
- [ ] 3.5 Feed the non-failing outcomes (`ended-ok`, `still-running`,
      `never-started`) back to the conversation without triggering a correction.
- [ ] 3.6 Add tests to `src/ai/aiStore.test.ts`: an error inside the bound sends
      a correction unasked; the bound stops further attempts and raises the
      banner instead; a new user request releases the bound; a stale program
      suppresses the correction; a non-failing outcome corrects nothing.

## 4. Panel affordances

- [ ] 4.1 Show an automatic correction as in progress in
      `src/components/AiPanel.tsx`, reusing the existing busy/`retrying`
      affordances rather than adding a new one.
- [ ] 4.2 Confirm the existing Stop cancels an automatic correction and leaves no
      further attempt queued.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format`)
- [ ] 5.5 `npm run e2e:chromium -- e2e/ai-assistant` — covers the apply-and-run
      actions this change alters. Check off only when the run passes; on failure
      leave unchecked and note what failed.
- [ ] 5.6 `npm run e2e:chromium -- e2e/program-execution` — the run path shares
      the frame loop being edited. Same rule: check off only on a passing run.
- [ ] 5.7 `npx openspec validate --changes`
- [ ] 5.8 Manual check on a machine that reports its error state: ask for a
      program that fails at runtime, confirm the assistant corrects it unasked,
      keeps failing to the bound, then offers the banner. Repeat on a machine
      that cannot report (ZX80 or Atom) and confirm nothing changes for it.
