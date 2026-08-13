## 1. Pin what exists, before changing it

- [ ] 1.1 Colocated test beside `src/ai/promptBuilder.test.ts`, driven from the
      dialect registry: for every registered dialect, compose the system prompt
      twice for the same `(dialect, canShowScreen, canDrive)` and assert the two
      are byte-identical. This is the property the whole change rests on and
      nothing currently checks it. Note that `sortEntries` uses `localeCompare`,
      whose collation is locale-dependent but stable within a run — which is what
      per-conversation caching needs, and what this pins.
- [ ] 1.2 Same sweep, asserting a per-dialect ceiling on the composed size, and a
      ceiling per section (`THIS MACHINE`, `LANGUAGE RULES`, `EVERY COMMAND …`,
      `CONTROL CODES …`, and the rest) so a failure names what grew. Record the
      measured figures in the test as the ceilings, with a little headroom; today
      they run from 19,223 characters to 37,544.
- [ ] 1.3 Assert the composed prompt clears the default model's minimum cacheable
      prefix by a stated margin. This is the claim the code currently gets
      backwards, and the guard that stops a future trim from silently falling
      under it — the failure mode of which is not an error but a cache that
      quietly stops working.

## 2. Replay what was sent

- [ ] 2.1 `src/ai/aiStore.ts` — a turn carries the request as sent as well as the
      request as shown. The panel keeps rendering the shown form; `baseHistory` is
      built from the sent form.
- [ ] 2.2 `persist` — decide what reaches storage. Measure a realistic
      conversation (a dozen turns on a p90-sized program) against the shared
      storage budget first; if both forms fit, persist both, and if not persist
      the shown form and note in the code that a reload starts from a cold prefix.
      Quota failures stay best-effort either way.
- [ ] 2.3 Tests: a two-turn conversation replays turn one byte-for-byte as it was
      sent; the panel still shows the short form. Extend `src/ai/aiStore.test.ts`,
      which today pins only that images stay on their turn.

## 3. One answer to what the assistant can do

- [ ] 3.1 `src/ai/promptBuilder.ts` — `loadSystemPrompt`'s two capability
      parameters become required. Expect the compiler to name every caller that
      was relying on a default; that list is the bug.
- [ ] 3.2 Resolve both flags from the chosen provider at one point, and have every
      caller use it: `src/components/AiPanel.tsx` (two sites), `src/ai/aiStore.ts`
      (four), `src/components/DocsDrawer.tsx`, `src/components/NewProjectDialog.tsx`.
- [ ] 3.3 Test: every request a single conversation makes — the user's, the
      continuation, the run fix, the judgement — composes the same system prompt.
- [ ] 3.4 Test the correction itself, not just the consistency: on a provider that
      can be given the machine, a user's own turn no longer tells the assistant the
      machine cannot be driven. This is the one behavioural change in the group and
      the spec delta turns on it.

## 4. A tool set that does not come and go

- [ ] 4.1 Offer the same tools on every turn of a conversation on a provider that
      supports them, rather than only on the turn that drives. `src/ai/aiClient.ts`
      already strips tools for providers without support and already bounds the
      exchange loop at eight rounds against the twenty-block lookback; neither
      changes.
- [ ] 4.2 A turn that offers tools without granting the machine answers any call
      with a refusal the assistant can read, in the shape the exchange loop already
      uses when a turn runs out of rounds. Do **not** supply a runner on every
      turn — that would let the assistant take the machine before anything has been
      run, which is a different product. Do not drop the call either: the seam's own
      contract says a call that vanishes is the one failure nothing can diagnose.
- [ ] 4.3 Test: the tool set a conversation sends is identical across its turns,
      including the turns that never call one; and a call made on a turn that
      granted no machine comes back to the assistant as a refusal rather than
      disappearing.
- [ ] 4.4 Review that driving still only happens where the spec says it does —
      asked for in the reply, granted once the program has been run and observed.
      The driving rules already say when to ask; if the assistant starts calling
      tools speculatively, that text is the lever, not the tool set.

## 5. Correct the record in the code

- [ ] 5.1 `src/ai/providers/anthropic.ts` — the breakpoint comment no longer
      claims the system prompt falls under the minimum cacheable size, and no
      longer asserts a fixed tool set as a given now that the code enforces it.
- [ ] 5.2 `src/ai/aiStore.ts` — the comment asserting a byte-stable prefix now
      describes what the code does, and says which field the wire reads.
- [ ] 5.3 Present tense, and no reference to this change or to what the code used
      to do — `eslint-rules/no-plan-references.js` enforces the first half and git
      records the second.

## 6. Measure, then decide the two open questions

- [ ] 6.1 With a real key, send three turns in one conversation and read the
      provider's cache figures off each response. Expect no cache read at all
      before this change, and a read of about the prefix from turn two after it.
      Until this is observed, groups 2–4 are unverified — no unit test can stand
      in for it.
- [ ] 6.2 Only then: decide whether to hold the cache for an hour rather than five
      minutes. It costs 2x on write against 1.25x and pays from the third read, so
      it turns on how long a user actually leaves between turns. Leaving it at
      five minutes is a legitimate outcome; record which and why in the code.
- [ ] 6.3 Only then: decide whether to spend a second of the four available
      breakpoints on the end of the system prompt, giving an anchor that survives
      history churn. Same standard — measure, then record the decision.

## 7. Quality gates

- [ ] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 7.2 `npm run e2e:chromium -- e2e/ai-assistant`. Only check off when it
      passes; a failure leaves this unchecked with a note on what failed.
- [ ] 7.3 No new e2e specs. Everything here is composition and request shape,
      which is unit-testable, and the one thing a browser could show — that the
      panel still renders the user's own sentence — is already covered by the
      existing specs in that folder.
- [ ] 7.4 No `docs/` change: nothing user-facing moves, so `npm run docs:build` is
      not required.
