## 1. The expectation block

- [ ] 1.1 Add the ` ```basic-expect ` grammar in a new `src/ai/expectations.ts`:
      a parser turning one block's text into `VAR <name> = <value>` and
      `SCREEN CONTAINS "<text>"` expectations, keeping an unparseable line as an
      `unchecked` entry rather than dropping it. Colocated
      `expectations.test.ts` covering both forms, a malformed line, an empty
      block and stray blank lines.
- [ ] 1.2 Teach `src/ai/codeExtractor.ts` to recognise the tag, and pin in
      `codeExtractor.test.ts` that an expectation block sets no `declared` kind,
      is never classified as a listing or a fragment, and that a reply carrying
      code *and* expectations still applies only the code.
- [ ] 1.3 Check the apply paths (`AiPanel.applyText` and whatever selects the
      block it applies) filter to recognised code blocks rather than taking the
      last block, and fix them if not. A test that applying a reply whose final
      block is expectations lands the program, not the expectations.

## 2. Evaluating expectations against a machine

- [ ] 2.1 Add the evaluator to `src/ai/expectations.ts`: given the parsed
      expectations, a `MachineVariable[]` and a `MachineScreenText | null`,
      return a per-expectation `passed` / `failed` / `unchecked`. Pure - it
      takes the readings, never the machine. Colocated tests for the
      normalisation rules the design fixes: quotes optional on both sides,
      numbers compared numerically (`42`, `42.0`, ` 42`), text compared exactly,
      screen rows matched with runs of spaces collapsed and never across a row
      boundary, a variable expectation on a machine reporting no variables read
      as `unchecked`, and an array-shaped value never matching an element.
- [ ] 2.2 Extend `src/app/aiRunCheck.ts` with the latch: an expectation that has
      held once stays passed, and at the verdict an expectation that never held
      is `failed` on `ended-ok` and `unchecked` on `still-running` /
      `never-started`. Keep it pure, alongside `classifyAiRunFrame`, and cover
      each row of the design's outcome table in `aiRunCheck.test.ts` - including
      a game-loop run whose expectation held early and whose verdict is
      `still-running`.

## 3. Wiring the run

- [ ] 3.1 Carry the expectations from the applied reply to the run: extract them
      in `aiStore` when applying, and hand them to the IDE store alongside the
      existing `aiRunCheckSeq` / run source.
- [ ] 3.2 Evaluate them in `EmulatorPane`'s armed check - sampled every N frames
      while watching plus once at the verdict, never per frame (the screen
      reader is not a polling primitive; see the design). Report the results on
      the existing sequence-tagged `runOutcome` field, adding no second channel
      and leaving the `AiRunOutcome` union unchanged.
- [ ] 3.3 In `aiStore`'s outcome subscription, treat a failed expectation as a
      failure of the run: build a correction the way `buildRunFix` does, spend
      one of the same `MAX_AUTO_FIX_ATTEMPTS`, keep the same edited-since /
      busy / no-context guards, and fall back to the same `pendingFix` banner
      when the budget is spent. Tests in `aiStore.test.ts` for: a failure
      correcting unasked, the cap shared with runtime errors rather than
      doubled, and an edited program falling back to the banner.
- [ ] 3.4 Extend `buildRunNote` so a run whose expectations all held says so,
      and add the correction message (which expectation, what was expected, what
      the machine reported) to `promptBuilder.ts` with tests in
      `promptBuilder.test.ts`.

## 4. Telling the assistant what it may ask for

- [ ] 4.1 Add the derived per-dialect capability statement (variables reportable
      or not; the screen always is) and fold it into `buildSystemPrompt`, so the
      prompt stays byte-stable per dialect. State the display-string convention
      the design fixes: values come back formatted, strings carry their quotes,
      arrays report a shape and a preview so no element expectation is possible.
- [ ] 4.2 Add the crosscheck test that constructs every registered machine and
      asserts the table matches what each actually implements, so the statement
      cannot drift from the machines (same shape as the registry guard added by
      `read-the-screen-as-text`).
- [ ] 4.3 Add the expectation block to the returning-code rules in
      `promptBuilder.ts`: when to state expectations, the two forms, and that
      they are optional. Keep it in the single shared constant so the composed
      prompt stays byte-stable per dialect.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format`)
- [ ] 5.5 `npm run e2e:chromium -- e2e/ai-assistant` - the modified capability.
      Check off only when the run passes; on failure leave it unchecked with a
      note on what failed.
- [ ] 5.6 `npm run e2e:chromium -- e2e/program-execution` - the run path the
      check rides on. Same rule.
- [ ] 5.7 `npx openspec validate --changes`
