## 1. Capture the screen

- [ ] 1.1 Add `src/app/screenCapture.ts`: a `ScreenCapture` type (media type +
      base64 PNG + pixel dimensions), a module-level registration for the live
      capture function, a last-known snapshot, and `captureScreen()` /
      `hasScreenCapture()` accessors — best-effort, returning null rather than
      throwing when there is no canvas or `toDataURL` fails.
- [ ] 1.2 Implement the integer nearest-neighbour upscale (`imageSmoothingEnabled
      = false`, long edge at least ~512 and never over 1024) in that module, via
      an offscreen canvas.
- [ ] 1.3 Add colocated `src/app/screenCapture.test.ts` covering the scale-factor
      choice at several native display sizes, the cap, and the null paths (no
      canvas registered, capture throws).
- [ ] 1.4 Register/unregister the capture function from `EmulatorPane`, taking a
      snapshot on unmount and when the machine stops so the last display stays
      attachable after the pane goes away.
- [ ] 1.5 Add a store flag for whether a capture is available, updated as the
      pane registers and snapshots, for the composer to subscribe to.

## 2. Carry an image on the provider seam

- [ ] 2.1 Extend `ChatMessage` in `src/ai/providers/types.ts` with an optional
      image attachment (user turns only) and document the constraint; add
      `acceptsImages` to `ProviderMeta`.
- [ ] 2.2 Set `acceptsImages` for all three providers in
      `src/ai/providers/registry.ts`.
- [ ] 2.3 Map the attachment in the Anthropic backend (an `image` block ahead of
      the text block in the same user message), leaving the top-level
      `cache_control` breakpoint and the prefix-caching behaviour intact.
- [ ] 2.4 Map the attachment in the OpenAI backend (`image_url` content part with
      a data URI) and the Gemini backend (`inlineData` part), extending
      `toGeminiContents` and its colocated test.
- [ ] 2.5 Add colocated tests asserting each backend's request shape with and
      without an attachment, and that a message with no attachment produces the
      exact same wire shape as today.

## 3. Show the screen with a request

- [ ] 3.1 Thread the attachment through `SendParams`, `DisplayMessage` and the
      wire history in `src/ai/aiStore.ts`, keeping images on past turns.
- [ ] 3.2 Persist a marker rather than bytes in `persist()`/the restore path, and
      render a restored marker without a thumbnail.
- [ ] 3.3 Add the attach control to `AiPanel`'s composer: gated on a capture
      being available and the provider accepting images, removable before
      sending, and showing a thumbnail of what will be sent.
- [ ] 3.4 Render sent attachments in the thread so a conversation reads back
      unambiguously.
- [ ] 3.5 Extend `src/ai/aiStore.test.ts` for attach/remove, that an attachment
      reaches the wire once and stays on its turn, and that persistence drops the
      bytes but keeps the marker.

## 4. Show the screen with a failed run

- [ ] 4.1 Capture at the run check's verdict in `EmulatorPane` — after rendering
      that frame, and only when the verdict is a failure or a visual expectation
      is waiting — and pass it to `reportRun`.
- [ ] 4.2 Extend the store's `runOutcome` with the optional capture and update
      `reportRun`'s signature and docs.
- [ ] 4.3 Attach the capture to the correction request built for a runtime error
      / failed expectation in `src/ai/promptBuilder.ts` + `aiStore.ts`, and skip
      it cleanly when there is no capture or the provider cannot be shown one.
- [ ] 4.4 Cover the failure-carries-a-frame, success-carries-nothing, and
      text-only-provider paths in the existing AI store/prompt-builder tests.

## 5. Visual expectations, judged by the assistant

- [ ] 5.1 Add the `SCREEN SHOWS <description>` form to `src/ai/expectations.ts`
      as a `visual` expectation; the local evaluator reports it `unchecked` with
      a reason, never passed or failed.
- [ ] 5.2 Teach the form in `buildExpectationRules`
      (`src/ai/machineObservability.ts`), gated on the provider accepting images,
      keeping the composed prompt stable per (dialect, provider).
- [ ] 5.3 Build the judging request in `promptBuilder.ts`: carries the capture and
      the stated descriptions, asks for a per-description verdict in a small
      fenced block and, on any failure, the corrected program in the same reply.
- [ ] 5.4 Parse the verdict block and fold it into the run result — pass folds
      into the run note, fail reports the run as failed, malformed or missing
      reports unchecked.
- [ ] 5.5 Issue the judging turn from `aiStore.ts` when the run check settles:
      inside `MAX_AUTO_FIX_ATTEMPTS`, marked as an automatic turn, stoppable, and
      never started when the program has changed since.
- [ ] 5.6 Report visual expectations as unchecked (never failed) when there is no
      capture or the provider cannot be shown one.
- [ ] 5.7 Extend `src/ai/expectations.test.ts`, `promptBuilder.test.ts` and
      `aiStore.test.ts` for parsing, prompt gating, verdict parsing (including
      malformed), the bound being shared with corrections, and stopping a
      judgement mid-flight.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck`
- [ ] 6.2 `npm test`
- [ ] 6.3 `npm run lint`
- [ ] 6.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 6.5 `npm run e2e:chromium -- e2e/ai-assistant` — including new scenarios for
      the attach control being available with a display and unavailable without
      one; a failing run leaves this unchecked with a note on what failed
- [ ] 6.6 `npm run e2e:chromium -- e2e/program-execution` — the run check is
      touched, so confirm running and debugging are unaffected
- [ ] 6.7 `npx openspec validate --specs` and re-read the delta against the
      implemented behaviour
