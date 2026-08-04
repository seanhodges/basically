## 1. Read the screen out of the thread

- [x] 1.1 Add a pure reader to `src/ai/aiStore.ts` for the display the thread is
      showing that the assistant has not been sent: the latest turn's
      `finalScreen`, returned only when no user turn already carries that image.
- [x] 1.2 Cover it in `src/ai/aiStore.test.ts`: nothing shown yet, a screen shown
      and unsent, the same screen after it has been sent, a screen already sent
      as a judging turn's attachment, and a thread restored with markers but no
      pixels.

## 2. Remove the control and carry the screen instead

- [x] 2.1 Remove the "Show screen" button, the attachment strip and the
      composer's capture state from `src/components/AiPanel.tsx`.
- [x] 2.2 Carry the thread's unsent screen with a request the user sends, where
      the chosen provider can be shown one.
- [x] 2.3 Render a user turn that carried a screen as a note rather than a second
      thumbnail, keeping the same wording a restored turn already uses.
- [x] 2.4 Drop the now-unused rules from `src/components/AiPanel.module.css`.
- [x] 2.5 Reword the line in `src/ai/promptBuilder.ts` that tells the model what
      the picture is: the screen the program left, not the machine right now.
      Update its colocated test.

## 3. Retire the button's plumbing

- [x] 3.1 Remove `screenCaptureAvailable` and its setter from `src/app/store.ts`.
- [x] 3.2 Remove the two calls to it from `src/components/EmulatorPane.tsx`,
      leaving the capture registration the run check needs.
- [x] 3.3 Update the comments in `src/app/screenCapture.ts` that describe the
      capture as something the user attaches by hand.

## 4. End-to-end

- [x] 4.1 Replace `e2e/ai-assistant/show-screen.spec.ts` with scenarios for the
      new behaviour: the composer offers no screen control; a request made after
      a checked answer carries the screen the thread is showing; the request
      after that carries none.
- [x] 4.2 Let `e2e/aiStub.ts` report the requests it answered, so a test can
      assert what a request actually carried.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run e2e:chromium -- e2e/ai-assistant`
