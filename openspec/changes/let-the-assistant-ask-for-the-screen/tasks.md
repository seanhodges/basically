## 1. The view grammar

- [x] 1.1 Add the screen-view request to `src/ai/expectations.ts` (alongside the
      expectation and verdict grammars): a `VIEW_FENCE_TAG` of `basic-view`, a
      `ScreenViewRequest` of `{ image: boolean; unknown: string[] }`, and
      `parseScreenViews`, which keeps an unrecognised line as `unknown` rather
      than dropping it.
- [x] 1.2 Read it in `src/ai/codeExtractor.ts`: mark the block `view: true`, keep
      it out of `isApplicableBlock`, and add `extractScreenViews` folding every
      view block in a reply into one request.
- [x] 1.3 Cover both in the colocated tests: parsing, the unknown line, an empty
      block, a reply with no block, and that a `basic-view` block is never
      offered for applying.

## 2. Asking, in the prompt

- [x] 2.1 Teach the form in `buildExpectationRules`
      (`src/ai/machineObservability.ts`): what the image view is for, that a
      `SCREEN SHOWS` expectation already counts as asking, and that naming
      nothing is the ordinary case — gated on the provider accepting images, and
      saying so when it does not.
- [x] 2.2 Extend the colocated tests for the gated and ungated wording, keeping
      the per-(dialect, provider) byte-stability assertion.

## 3. Carrying the request into the run

- [x] 3.1 Extend `requestAiRun` and the store's AI-run state to carry the named
      views next to the expectations, and the run outcome to carry them back.
- [x] 3.2 Read the views out of the applied reply in `AiPanel` and pass them to
      `requestAiRun`.
- [x] 3.3 Capture in `EmulatorPane` when the views asked for it or a visual
      expectation is waiting — no longer when the run failed.

## 4. Reporting what was and was not shown

- [x] 4.1 Report an unavailable view in `buildRunNote`
      (`src/ai/promptBuilder.ts`): a view this IDE cannot produce, the image on a
      provider that cannot be shown one, or nothing captured.
- [x] 4.2 Tell a correction that the screen can be shown if it would help, when a
      failing run could have carried one and did not
      (`buildRunFix`/`buildExpectationFix`).
- [x] 4.3 Route it in `src/ai/aiStore.ts`: send the image when it was asked for,
      collect unavailable views, and leave the correction loop and its bound
      otherwise untouched.
- [x] 4.4 Extend `aiStore.test.ts` and `promptBuilder.test.ts`: an asked-for view
      carries the image, an unasked failure carries none but says so, an
      unavailable view is reported without failing the run, and a visual
      expectation still carries the screen unasked.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check` (or `npm run format` to fix)
- [x] 5.5 `npm run e2e:chromium -- e2e/ai-assistant` — the attach control this
      change does not touch must still behave; a failing run leaves this
      unchecked with a note on what failed
- [x] 5.6 `npm run e2e:chromium -- e2e/program-execution` — the run check is
      touched again, so confirm running and debugging are unaffected
- [x] 5.7 `npx openspec validate --change let-the-assistant-ask-for-the-screen`
      and re-read the delta against the implemented behaviour
