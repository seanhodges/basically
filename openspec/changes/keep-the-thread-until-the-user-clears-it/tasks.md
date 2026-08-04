## 1. Mark an interrupted answer

- [x] 1.1 Add `interrupted?: boolean` to `PersistedMessage` in `src/storage/settings.ts`, documented beside the existing `incomplete` note: it narrows `incomplete` to "the page went away", where plain `incomplete` also covers Stop and provider truncation, and is absent on threads stored before it existed
- [x] 1.2 Add `interrupted?: boolean` to `DisplayMessage` in `src/ai/aiStore.ts`
- [x] 1.3 In `persist()`, emit `interrupted: true` alongside `incomplete: true` only when the message is still streaming, so only the throttled mid-stream write can produce it
- [x] 1.4 Carry `interrupted` from the persisted thread into the restored `DisplayMessage` when the store hydrates — no code needed: the store assigns the loaded thread straight across, and the field is now on both types
- [x] 1.5 Unit-test in `src/ai/aiStore.test.ts`: a mid-stream persist stores `interrupted`; a stopped answer stores `incomplete` without it; a finished answer stores neither; a thread stored without the flag still loads. Also covered: an answer cut off by the output limit is not interrupted, and the marker survives the whole-thread rewrite that the next turn performs

## 2. Offer the interrupted answer again

- [x] 2.1 In `src/components/AiPanel.tsx`, render a message-level cut-short note on any assistant turn marked interrupted, so it shows whether or not code arrived; leave the existing in-block note for the stopped/truncated case
- [x] 2.2 Make the panel's send path take an optional request text, defaulting to the composer's contents, and fix the click handlers that currently pass it straight to `onClick` so React's event is never taken as the request. The composer is cleared only when the request came from it, so asking again leaves half-typed text alone
- [x] 2.3 Add the **Ask again** action to the note, putting the preceding user turn's request afresh under the same busy/offline guards as an ordinary send, leaving the cut-short answer in place above it
- [x] 2.4 Style the note from the existing block-note rules in `AiPanel.module.css`, adding a rule only if it needs to sit outside a code block

## 3. Composer commands

- [x] 3.1 Match `/clear` and `/hide` against the trimmed, case-lowered input at the top of the panel's send path — ahead of the busy/offline return and the API-key gate — then clear the composer and return without asking the provider anything
- [x] 3.2 `/clear` calls the AI store's existing reset (abort, ignore late deltas, zero the correction budget, wipe the stored conversation); add no new store action
- [x] 3.3 `/hide` calls the store action the panel already holds for stepping aside for the machine, so it closes on both the split and tabbed layouts; do not use the toolbar's panel toggle, which does nothing when tabbed
- [x] 3.4 Let a command past the Send button's disabled guard while offline
- [x] 3.5 Add a one-line hint by the composer once the thread is non-empty, naming both commands
- [x] 3.6 Unit-test in `src/ai/aiStore.test.ts` that a reset mid-stream ignores the late completion and leaves nothing stored — already asserted by the existing `reset clears the thread and ignores a late completion` test, so nothing was added

## 4. End-to-end coverage

- [x] 4.1 Extend `e2e/aiStub.ts` so an answer can be left outstanding while the test does something to the panel, and update the `e2e/ai-assistant/ai-panel.spec.ts` header comment. **Changed from the plan:** `route.fulfill` sends one complete response, so a genuinely part-written stream is not producible at this level. The stub gained a hold-open delay instead (which is what task 4.3 needs), and the restored-interrupted case is seeded into the storage the IDE reads a thread back from — the same contract, with the rules for what gets written pinned in `src/ai/aiStore.test.ts`
- [x] 4.2 Spec: a restored interrupted answer keeps its text, shows the cut-short note with no code fence anywhere in it, and **Ask again** puts the same request (asserted against the turns the stub recorded)
- [x] 4.3 Spec: closing the assistant mid-answer and reopening it shows the answer arrived in full — the keep-working-while-away requirement
- [x] 4.4 Spec: `/clear` empties the thread, asks the provider nothing, leaves the program in the editor unchanged, and stays empty across a reload
- [x] 4.5 Spec: `/hide` closes the assistant on a desktop viewport **and** on a phone viewport (copy the phone pattern from `e2e/ai-assistant/checked-answers.spec.ts`), and reopening shows the conversation intact

## 5. Confirm a departure mid-answer

- [x] 5.1 Add `src/ai/unloadGuard.ts` exporting `installUnloadGuard(target?)`: subscribe to the AI store and add/remove a `beforeunload` listener as an answer starts and stops arriving, returning the undo. The handler both calls `preventDefault()` and sets `returnValue` — browsers disagree on which raises the prompt, and neither shows words of ours
- [x] 5.2 Watch for an answer actually arriving, not the assistant being busy: a running check has already stored its answer, and only the verdict would be lost
- [x] 5.3 Call it once from `src/App.tsx`. **Changed from the plan:** not from the entry module — that deliberately loads neither the editor nor the assistant so the standalone player pays for neither, and importing the AI store there would put it in the entry chunk
- [x] 5.4 Take the event target as a parameter rather than reaching for the global, so the node tests can watch a plain object. Declaring a `window` in these tests makes the machine cores take their browser path and the suite fails to load
- [x] 5.5 Unit-test in `src/ai/unloadGuard.test.ts`: idle is unguarded, an arriving answer is guarded, the handler raises the prompt, it stands down when the answer arrives and when the thread is cleared, it does not stack as the answer grows, and uninstalling takes it with it
- [x] 5.6 End-to-end in `e2e/ai-assistant/ai-panel.spec.ts`: reloading mid-answer raises a `beforeunload` dialog, and reloading with the answer already in raises nothing. Both held over `--repeat-each=4`, so the flakiness the plan allowed for did not materialise and the tests stay

## 6. Quality gates

- [x] 6.1 `npm run typecheck`
- [x] 6.2 `npm test` — 4763 passed, 6 files skipped as usual
- [x] 6.3 `npm run lint`
- [x] 6.4 `npm run format:check` (or `npm run format`)
- [x] 6.5 `npm run e2e:chromium -- e2e/ai-assistant` — 22 passed; `e2e/shell` also run (16 passed) because the composer gained a line
- [x] 6.6 `npx openspec validate --specs`
