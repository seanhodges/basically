## Context

Showing the assistant the screen shipped with the IDE choosing the moment:
`EmulatorPane`'s run check captures when the verdict is a failure, when an
expectation failed, or when a visual expectation is waiting to be judged. The
capture, the provider mapping and the storage rules are all settled and are not
in question here — see the archived
`2026-08-02-show-the-assistant-the-screen-implemented` design and
`docs/contributing/architecture.md`. What changes is only who decides.

The mechanism to hand that decision over already half exists. Replies are
already mined for fenced blocks the editor never applies — `basic-expect` for
what should be true after a run, `basic-judge` for a verdict on a screen — and
the applied reply's expectations already ride into the run through
`requestAiRun`. A named view is the same shape of thing travelling the same
path.

## Goals / Non-Goals

**Goals:**

- Let the assistant say, with its code, which views of the screen it wants when
  that program runs; carry exactly those.
- Stop inferring from a failure that the picture is wanted, without stranding a
  failure that turns out to need one.
- Report a named-but-unproducible view rather than quietly substituting.

**Non-Goals:**

- No `Dialect`/`MachineEmulator` change: the capture path is untouched, so the
  seam is exactly as unaffected as it was before.
- No second view. The grammar admits one; only the image is implemented.
- No mid-turn asking, no tool-calling, no agentic loop.
- No change to capture, encoding, provider mapping, persistence, or the user's
  attach control.

## Decisions

### A third sibling fence, not a fourth channel

**Decision:** the assistant names views in a ` ```basic-view ` block, one view
per line, currently only `SCREEN IMAGE`. It joins `basic-expect` and
`basic-judge` as a block that is parsed, never applied, and never program text.

**Why:** the alternatives are worse in specific ways. Putting the request in the
`basic-expect` block conflates an assertion with a request — an expectation
states what should be true, a view states what the assistant wants to see, and a
block that holds both would need the reader to tell them apart by shape.
Inferring the request from prose ("could you show me the screen?") makes the
mechanism depend on phrasing. A dedicated tag reuses the extractor, the
non-applicable rule, and the reader's existing mental model of what a
non-`basic` fence means.

**Why only the image:** the text view is not something the assistant lacks —
`SCREEN CONTAINS` already checks text locally, for free, every few frames.
Adding `SCREEN TEXT` as a nameable view would be adding a channel, not handing
over a decision. The grammar takes a list so the next view costs a line.

### A visual expectation is itself an ask

**Decision:** `SCREEN SHOWS` continues to carry the screen, whether or not a
`basic-view` block also names the image.

**Why:** an expectation that can only be settled by looking is already the
assistant saying the picture matters. Requiring it to also name the view would
be a rule whose only effect is to catch out a model that stated its expectation
and thought it was done — the same failure the two-block design exists to avoid.

### The request travels with the expectations

**Decision:** the named views ride into the run alongside the expectations, on
`requestAiRun`, and come back on the run outcome. `EmulatorPane` captures when
the views asked for it or a visual expectation is waiting — not when the run
failed.

**Why:** it is the same journey, from the same applied reply, consumed at the
same point in the run check. A second channel for it would be a second thing to
keep in step. Following the existing convention also means the pane keeps
deciding nothing: it captures what it was told to capture.

### Unavailability is reported, not enforced up front

**Decision:** an unproducible view — one the IDE has no view for, or the image
where the provider cannot be shown one — is carried on the outcome and reported
in the note that rides along with the next request. It never fails the run and
never prompts a correction.

**Why:** the assistant is told up front what can be produced, so a bad ask is
already unlikely; what remains is a mistake, and a mistake answered with silence
is one the model cannot learn from mid-conversation. Reporting it costs a clause
in a note that was being sent anyway. Failing the run over it would turn a
misnamed view into a program defect, which it is not.

### A failure with no ask gets an offer, not a picture

**Decision:** where a run fails, the provider could have been shown an image and
none was asked for, the correction request says the screen can be shown if it
would help.

**Why:** this is the one case the old rule was right about — the assistant
cannot foresee a crash it did not intend. But the answer is a sentence, not a
picture: the next turn re-runs anyway (the correction is applied and run), so an
assistant that wants the screen asks for it in the correction it is already
writing. Sending it unasked is what this change exists to stop.

## Risks / Trade-offs

- **The assistant asks for nothing and diagnoses worse.** → The failure path
  tells it the screen is available, and the prompt rules say plainly when to ask.
  The cost of not asking is one turn, not a dead end.
- **The assistant asks for the image every time.** → Then this change is
  cost-neutral rather than a saving, and no worse than the rule it replaces —
  which sent a picture for every failure regardless. The rules tell it what the
  image is for; a model that over-asks is a prompt problem, fixable without
  re-plumbing.
- **A fourth fence tag is a fourth thing a model can get wrong.** → A malformed
  or unrecognised line inside the block is reported as an unavailable view, so
  getting it wrong is visible and harmless. An unrecognised block is simply not a
  request, exactly as an unrecognised block is not code.
- **Two ways to end up with a picture** (naming the view, or stating a visual
  expectation). → They are one rule stated once in the prompt: ask when the
  picture matters, and a visual expectation counts as asking.
