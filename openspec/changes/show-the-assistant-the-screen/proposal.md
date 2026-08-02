## Why

The assistant writes programs for machines whose entire output is a picture, but
it has never been allowed to look at one. All it can learn about a run today is
the machine's error report and the characters `readScreenText` decodes — so a
plotted circle that comes out as an egg, a sprite drawn off-screen, a MODE the
program forgot to set, or a display that is simply blank all read back as "ran
without failing". The user can see what is wrong at a glance and has no way to
show it; the assistant is left guessing from source alone.

Every registered machine already renders its display to a canvas each frame, and
all three supported providers accept image input. The missing piece is the
permission — and the plumbing — to put that frame in front of the assistant.

## What Changes

- **The user can show the assistant the screen.** A control in the assistant's
  composer attaches the machine's current display to the request being written;
  the thread shows what was attached, and it is sent to the chosen provider with
  the message.
- **A run the assistant initiated can carry its screen back.** When a run
  started from the assistant is checked and that check ends in a failure — a
  machine error report, or a stated expectation that did not hold — the display
  as it stood at the verdict travels with the correction request, so the
  assistant diagnoses against the picture rather than against the source alone.
- **The assistant can state what the screen should look like, and judge it.**
  The expectation grammar gains a visual form alongside `VAR` and
  `SCREEN CONTAINS`. Because no machine can evaluate one, a visual expectation
  is settled by showing the assistant the captured display and asking it to
  judge its own program; a verdict of "not as stated" is a failed run on exactly
  the terms a runtime error already is, and travels through the same bounded,
  stoppable, unrequested-correction loop.
- **The provider seam grows image input, capability-gated.** A message may carry
  an image as well as text, and each backend maps it to its own wire format. A
  provider that cannot take images is honestly incapable rather than silently
  dropping the picture: the attach control is unavailable, visual expectations
  are reported unchecked, and everything else works exactly as it does now.
- **Privacy and cost stay where the user put them.** The image goes only to the
  provider the user chose, alongside the program text that already goes there;
  it is sent only when the user attaches it or when a run needs judging, never
  on every request; and the assistant remains entirely optional.

## Non-goals

- **No new machine seam.** Nothing is added to `Dialect`/`MachineEmulator` — the
  display already reaches a canvas through `renderTo`, and the capture is taken
  from there. No dialect gains a per-machine screenshot implementation.
- **No replacement for reading the screen as text.** `SCREEN CONTAINS` keeps
  being checked by the machine, locally and for free. The image is for what
  characters cannot express.
- **No video, no history.** One still frame, captured at the moment it is
  needed. No multi-frame sequences, no animation, no scrubbing back to an
  earlier state of the run.
- **Not attached to every request.** The screen rides along when the user asks
  or when a run must be judged, not as blanket context on every turn.
- **No image bytes in the persisted conversation.** A reloaded thread records
  that a screen was shown, not the pixels.
- **No new provider, no new model picker, no server involvement.** The IDE stays
  fully client-side and the existing three backends keep their fixed models.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the assistant may be shown the machine's display — attached by
  the user to a request, and carried with a failed run it initiated; it may
  state expectations about what should be visible and is asked to judge those
  against the captured display, with a verdict of "not as stated" failing the
  run on the same terms as a runtime error; and what a provider can be shown is
  a stated capability, so a provider without image input degrades honestly.

## Impact

- **`src/ai/providers/`** — `ChatMessage`/`StreamOptions` grow an optional image
  attachment; `ProviderMeta` gains an image-input capability flag; the Anthropic,
  OpenAI and Gemini backends each map the attachment onto their own request
  shape (and keep prompt caching intact on Anthropic).
- **`src/ai/`** — `expectations.ts` gains the visual expectation form and reports
  it as needing a look rather than passing or failing; `promptBuilder.ts` teaches
  the form and builds the judging request; `aiStore.ts` runs the judging turn
  inside the existing bounded automatic-correction budget; the persisted
  conversation stores an attachment marker, not bytes.
- **`src/components/`** — `AiPanel` gains the attach control and shows what was
  attached; `EmulatorPane` captures the frame at the point where it already
  reads the machine for the run check.
- **`src/app/store.ts`** — the AI run outcome carries the captured display
  alongside the outcome and expectation results it already carries.
- **`e2e/ai-assistant/`** — new scenarios for attaching, for a judged run, and
  for a provider that cannot be shown an image.
- **Dependencies** — none added; all three vendor SDKs already model image
  content.
