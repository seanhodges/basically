## 1. Settle the deferred decision

- [ ] 1.1 Decide what a check does when a step-through debug session is live
      (defer, skip and offer unchecked, or clobber with warning); record the
      choice in `design.md` under Open Questions and pin it with a test

## 2. Carry the program on the run request

- [ ] 2.1 Extend the AI-checked run request in `src/app/store.ts` to carry the
      candidate program and the source it was derived from, alongside the
      expectations and views it already carries
- [ ] 2.2 Extend the run-outcome report to carry the derived-from source next to
      the program that ran
- [ ] 2.3 Make the run effect in `src/components/EmulatorPane.tsx` tokenize the
      candidate rather than the editor's source when the request is the
      AI-checked one; a plain run is unchanged
- [ ] 2.4 Cover both in `src/app/store.test.ts`: an AI-checked request carries a
      program the editor does not hold, and a plain run still runs the editor

## 3. Fire the check from the reply

- [ ] 3.1 Build the candidate in `src/ai/aiStore.ts` from the reply's last
      applicable block — a declared whole listing as returned, a declared
      fragment through `mergeBasicLines` against the source it was written
      against — and leave an unknown-kind block unchecked
- [ ] 3.2 Request the AI-checked run when a reply settles, without touching the
      editor; carry the reply's stated expectations and views as the apply path
      does today
- [ ] 3.3 Lint the candidate before requesting the run, and route a candidate
      that will not build into the existing correction path on the same bounded
      attempt rather than letting the loop wait on a verdict that never arrives
- [ ] 3.4 Change the staleness guard to compare the source the answer was
      written against, not the program that ran
- [ ] 3.5 Test in `src/ai/aiStore.test.ts`: a failing check corrects without the
      editor changing; the correction still proceeds when only the check ran a
      different program (the guard-inversion regression); a candidate that will
      not tokenize is reported as a failure; an unknown-kind block is not checked

## 4. Stop arming the check on apply

- [ ] 4.1 Make the apply-and-run actions in `src/components/AiPanel.tsx` request
      a plain run; applying and running an already-checked answer must not check
      it again
- [ ] 4.2 Leave applying without running exactly as it is — the machine does not
      start

## 5. Say which stage the work is in

- [ ] 5.1 Add a being-checked flag to the displayed message in `src/ai/aiStore.ts`,
      set when a check is armed for it and cleared when the outcome lands or the
      user stops
- [ ] 5.2 Widen the status block in `src/components/AiPanel.tsx` to render past
      the end of streaming, and add the checking label (naming the machine) and
      the judging label
- [ ] 5.3 Make the store's busy flag cover a check in flight, and make Stop end a
      check as it ends any other stage
- [ ] 5.4 Test the label chosen for each stage and that busy blocks a new request
      while a check is running

## 6. Show the finished work to the user

- [ ] 6.1 Capture the machine's screen unconditionally at the final verdict in
      `src/components/EmulatorPane.tsx`, not only when a view was asked for
- [ ] 6.2 Carry that screen on its own field, distinct from the one shown to the
      provider, and add exactly one thread entry for it when the loop settles —
      including when the correction bound was reached or the user stopped
- [ ] 6.3 Exclude it from the outgoing request history, and record it in the
      saved conversation as a marker without the pixels
- [ ] 6.4 Test that it never appears in a later request's history, that several
      attempts produce one screen and not one per attempt, and that a reloaded
      thread records it without restoring it

## 7. Make the wait bearable

- [ ] 7.1 Advance several frames per tick while a check is armed, leaving the
      check's frame-counted rules unchanged
- [ ] 7.2 Add a fallback clock so a check in a backgrounded browser tab settles
      instead of stalling the assistant loop
- [ ] 7.3 Leave the machine showing the checked program's final state, and make
      Run return to the editor's program

## 8. Documentation

- [ ] 8.1 Update the AI-assistant guide in `docs/` to describe answers arriving
      already checked, the stages shown while waiting, and the screen shown at
      the end — without referencing internal files
- [ ] 8.2 Update the AI/run meeting point in
      `docs/contributing/architecture.md` to describe the trigger moving from the
      apply action to the reply

## 9. Quality gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npm test`
- [ ] 9.3 `npm run lint`
- [ ] 9.4 `npm run format:check`
- [ ] 9.5 `npm run docs:build` (docs/ changed in group 8)
- [ ] 9.6 `npm run e2e:chromium -- e2e/ai-assistant` — rewrite the specs that
      assert today's on-apply arming, and add coverage for the editor staying
      unchanged while the machine runs a candidate, the status label tracking
      the stage, and exactly one screen landing at the end of the loop
- [ ] 9.7 `npm run e2e:chromium -- e2e/program-execution` — the run path is
      touched even though its requirements are not; confirm a plain run is
      unaffected
