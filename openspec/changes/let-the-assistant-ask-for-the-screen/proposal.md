## Why

The assistant can now be shown the machine's screen, but the IDE decides when:
a run that failed gets a picture, a run that stated a visual expectation gets
one, everything else gets none. That rule is a guess about a thing the IDE
cannot know. A text adventure that crashed on a `GOSUB` gets its screen sent for
nothing; a kaleidoscope that ran perfectly and drew the wrong thing gets none,
because "no error" reads as "nothing to see".

Only the assistant knows what it wrote. No rule applied to the finished screen
tells a program that printed a table from one that drew a table's border out of
graphics characters. So the decision belongs to the author of the program, and
the assistant should say — alongside the code it returns — whether the picture
will be worth sending.

## What Changes

- **The assistant names the views it wants.** Alongside its code it may ask for
  the machine's screen as an image, and the outcome of running that program
  carries what it asked for and nothing further.
- **A failed run no longer sends the screen unasked.** The IDE stops inferring
  that a failure means pixels matter. Where a picture could have been shown and
  was not asked for, the correction request says so, so the assistant can ask on
  its next turn — which is the turn that re-runs anyway.
- **A stated visual expectation still carries the screen**, because an
  expectation only a look can settle is already the assistant asking for the
  look. Asking twice for the same thing is not required of it.
- **A view that cannot be produced is reported as unavailable** rather than
  silently answered with something else — a view this IDE does not have, or the
  screen image on a provider that cannot be shown one.
- **Nothing about what the assistant is asked to do changes with the views.** A
  correction is the same correction whether or not a picture came with it.

## Non-goals

- **No new view.** The screen image is the only view that can be named, because
  it is the only one the assistant cannot already get: what the screen says as
  text it can assert on with `SCREEN CONTAINS`, checked locally and for free.
  The grammar leaves room for another view; this change adds none.
- **No asking mid-turn.** The assistant names its views in the reply it was
  already sending. No tool-calling, no agentic loop, no per-provider tool
  protocol — the cross-provider parity of the assistant is worth more than
  saving a turn.
- **No looking again within a turn.** Having named a view, the assistant sees
  that view. Wanting a different one is a thing it says on its next turn.
- **The user's own control is untouched.** Attaching the screen to a request
  stays exactly as it is — this is about what the IDE sends unasked, not about
  what the user can show.
- **No change to how a screen is captured, sent, or stored.** Native resolution,
  same provider mapping, still no bytes in storage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the assistant may name the screen views it wants alongside the
  code it returns, and a run's outcome carries what was named rather than what
  the IDE inferred — replacing the rule that a failed run always shows the
  screen; a named view that cannot be produced is reported as unavailable.

## Impact

- **`src/ai/`** — a small screen-view grammar and its fence tag alongside the
  existing expectation and verdict blocks; `codeExtractor` reads it and keeps it
  out of the apply path; `promptBuilder` teaches it, reports an unavailable view,
  and tells a correction when a picture could have been asked for; `aiStore`
  routes the request instead of inferring it.
- **`src/app/store.ts`** — the AI run request carries the named views next to the
  expectations it already carries, and the outcome carries them back.
- **`src/components/`** — `AiPanel` reads the named views out of the applied
  reply; `EmulatorPane` captures when they were asked for rather than when the
  run failed.
- **`e2e/ai-assistant/`** — unchanged: the user-facing attach control this change
  does not touch is the part that is automatable without a provider.
- **Dependencies** — none.
