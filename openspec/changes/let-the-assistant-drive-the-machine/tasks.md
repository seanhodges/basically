## 1. Carry the screen text that is already read

- [x] 1.1 Keep the `MachineScreenText` from the verdict-frame sample in
      `EmulatorPane` instead of discarding it after `evaluateExpectations`, and
      carry it on `reportRun` beside `screen` / `finalScreen`
- [x] 1.2 Extend the run-outcome shape in `src/app/store.ts` to hold it, and
      update the store's colocated tests
- [x] 1.3 Add `SCREEN TEXT` to `ScreenViewRequest` / `parseScreenViews` /
      `mergeScreenViews` in `src/ai/expectations.ts`, ungated by provider
- [x] 1.4 Extend `src/ai/expectations.test.ts` for the new view, including that
      an unreadable screen reports it unavailable rather than empty
- [x] 1.5 Update `buildScreenViewRules` so the assistant is told to prefer text
      for word output and the picture for what only a picture settles; update
      `src/ai/machineObservability.test.ts` and `src/ai/promptBuilder.test.ts`

## 2. Tools on the provider seam

- [x] 2.1 Add tool definitions to `StreamOptions`, tool calls to `StreamResult`,
      and tool results to `ChatMessage` in `src/ai/providers/types.ts`
- [x] 2.2 Add the tools capability flag to `ProviderMeta` and set it per backend
      in `src/ai/providers/registry.ts`
- [x] 2.3 Pass tools through in `src/ai/providers/anthropic.ts`, stop discarding
      non-text blocks from the final message, and return any tool calls
- [x] 2.4 Correct the prompt-cache comment in `anthropic.ts` — a *fixed* tool set
      is as byte-stable as the per-dialect system prompt; it is variance, not
      presence, that invalidates
- [x] 2.5 Declare the capability honestly for `openai.ts` and `gemini.ts`, wiring
      tools only where the backend is given them
- [x] 2.6 Add the bounded exchange loop to `src/ai/aiClient.ts` beside the
      existing per-provider clamping: run the caller's handler, append results,
      repeat until the reply stops calling or the bound is reached; abort stops
      the loop as well as the in-flight request
- [x] 2.7 Add `src/ai/aiClient.test.ts` covering the loop, its bound, an
      unknown tool name coming back as a tool error rather than a throw, and
      that a request offering no tools takes the single-exchange path unchanged

## 3. Driving the machine

- [ ] 3.1 Add `src/app/machineControl.ts` — a module-level registry modelled on
      `src/app/screenCapture.ts`, exposing press/type/joystick/advance/wait-for
      text/read/freeze/release
- [ ] 3.2 Implement the driver's own bounded frame advance over `runFrame()` with
      frame-counted key releases, honouring each layout's `minHoldFrames`; do
      **not** register a frame hook (single slot, already contended)
- [ ] 3.3 Resolve key names through `Dialect.keyboardLayout` and joystick roles
      through the controller bindings, falling back to mapped keys where the
      machine has no joystick port
- [ ] 3.4 Register the control from `EmulatorPane` alongside the screen capture,
      and unregister on stop/unmount; add freeze support to the tick
- [ ] 3.5 Add `src/app/machineControl.test.ts` driving a real machine: typing
      reaches an `INPUT` prompt, waiting for text resolves and times out, and
      every key is released when driving ends
- [ ] 3.6 Derive the per-dialect key-name list in
      `src/ai/machineObservability.ts` from the keyboard layout, with no emulator
      constructed and byte-stable per dialect
- [ ] 3.7 Extend `src/ai/machineObservability.test.ts` to construct every
      registered machine and crosscheck that each derived key name is one that
      machine actually accepts — the project's anti-drift pattern

## 4. The turn that drives

- [ ] 4.1 Add the drive ask to the views the assistant can name, and the rules
      telling it what it can press on this machine and what driving costs
- [ ] 4.2 Turn `judgeScreen` in `src/ai/aiStore.ts` into the turn that may drive
      first: offer the tools, freeze the machine, run the exchange, then read the
      same `basic-judge` verdict as today
- [ ] 4.3 Gate the whole path on the provider's stated tools capability, so a
      provider without it behaves exactly as today
- [ ] 4.4 Report driving failures — wait timed out, unknown key, machine never up
      — as their own outcome: never a failed run, never a correction, and any
      expectation the driving never reached left unchecked
- [ ] 4.5 State in the thread what input was sent when input was actually sent,
      and nothing when the assistant only waited or looked
- [ ] 4.6 Extend `src/ai/aiStore.test.ts` for the driving turn, the provider
      gate, the failure semantics, and the visibility rule

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint`
- [ ] 5.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 5.5 Extend `e2e/aiStub.ts` to answer a sequence of requests and emit
      `tool_use` blocks in the SDK's streaming wire format; add a driving
      scenario under `e2e/ai-assistant/`
- [ ] 5.6 `npm run e2e:chromium -- e2e/ai-assistant` — leave unchecked with a
      note on what failed if it does not pass
- [ ] 5.7 `npx openspec validate --specs`
