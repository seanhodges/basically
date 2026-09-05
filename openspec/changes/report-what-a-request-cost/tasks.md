## 1. Carry the cost through the seam

- [ ] 1.1 `src/ai/providers/types.ts` — `StreamResult` gains what one exchange
      cost: newly processed, served from cache, written to cache, and the answer's
      own size. Every field optional; absent means the provider did not say, which
      is not the same as nought and the type must not let the two be confused.
- [ ] 1.2 `src/ai/providers/anthropic.ts` — read the usage off the final message.
      This is the only backend with cache figures to report.
- [ ] 1.3 `src/ai/providers/openai.ts` and `gemini.ts` — read what each reports;
      leave the cache figures absent.
- [ ] 1.4 `src/ai/aiClient.ts` — sum across the rounds of one turn, so a turn that
      drove the machine reports the whole turn rather than its last exchange.
      Summing here rather than in each backend keeps the backends reporting one
      exchange and knowing nothing about turns.
- [ ] 1.5 Colocated tests: a missing figure arrives missing rather than as nought,
      per backend; a three-round turn reports the sum of its rounds.

## 2. Keep it with the conversation

- [ ] 2.1 `src/ai/aiStore.ts` — an answer keeps what it cost; the thread keeps a
      running total. Both survive `persist` and `loadAiConversation`, or a
      restored conversation reports a total missing everything before the reload.
- [ ] 2.2 An answer that was stopped, cut short by the output budget, or failed
      keeps whatever was reported before it ended. Where nothing was reported, the
      figures stay absent — never nought.
- [ ] 2.3 Clearing the conversation clears the total with it, on the same path
      that clears everything else.
- [ ] 2.4 Tests in `src/ai/aiStore.test.ts`: the total sums its answers; a
      restored conversation keeps its total; a stopped answer keeps what it spent;
      clearing resets it.

## 3. State it in the panel

- [ ] 3.1 `src/components/AiPanel.tsx` — per-answer figures, secondary to the
      answer and out of the way of reading it. Follow whatever the panel already
      does for an answer's other secondary state rather than introducing a new
      register.
- [ ] 3.2 The conversation's running total, where the conversation's own controls
      live.
- [ ] 3.3 An unavailable figure reads as unavailable. Do not print a dash that
      could be read as nought, and do not omit the row entirely — a user comparing
      providers should be able to see that this one does not say.
- [ ] 3.4 Labels describe the request, not the invoice: what was newly processed,
      what was served from cache, what the answer came to. Tokens as the unit,
      because it is the only unit the IDE knows.

## 4. Tests

- [ ] 4.1 The unit tests in groups 1 and 2 are the bulk of it — accumulation,
      absence, persistence and reset are all logic, and per CLAUDE.md that belongs
      in colocated `*.test.ts`.
- [ ] 4.2 One browser test, extending an existing journey in `e2e/ai-assistant/`
      rather than a new cold start: an answer arrives and its cost is readable.
      This pays rent only because the panel's rendering of secondary state is the
      one part a unit test cannot show; nothing else in this change needs a
      browser.
- [ ] 4.3 No per-provider e2e matrix. The provider differences are in what arrives
      through the seam, which is a unit test.

## 5. Documentation

- [ ] 5.1 `docs/guide/` — the assistant's page gains a short section on reading
      what an answer cost, and on why some providers report less than others.
      Guide conventions: no `src/` paths, no internal symbols, relative links.
- [ ] 5.2 Do not touch the sidebar in `docs/.vitepress/config.ts`. This is a
      section within an existing page, not a new one.

## 6. Verify against the thing it was built to see

- [ ] 6.1 With a real key, run a conversation of three turns and read the figures
      the panel now shows. Before `stabilise-the-cached-prefix` lands, expect
      nothing served from cache on any turn — that is this change reporting
      honestly, not failing.
- [ ] 6.2 After that change lands, the same three turns should show most of the
      request served from cache from turn two. This is the check neither change
      can make on its own, and the reason to land them together.
- [ ] 6.3 Record the per-machine system prompt sizes the pinning tests measure
      alongside these figures, so what a machine costs to describe is finally a
      number and stays one.

## 7. Quality gates

- [ ] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 7.2 `npm run docs:build` (docs/ changed in group 5).
- [ ] 7.3 `npm run e2e:chromium -- e2e/ai-assistant`. Only check off when it
      passes; a failure leaves this unchecked with a note on what failed.
