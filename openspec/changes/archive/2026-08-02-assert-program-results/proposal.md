## Why

Knowing a program ran is not knowing it worked. Once the assistant is told the
outcome of its own run, the obvious next failure is the one nothing catches: a
program that starts, runs to the end, reports no error, and computes the wrong
answer. Nothing in the loop can tell that from success.

The machines can already answer. A running program's variables are readable on
most of them, and its screen becomes readable as text alongside this work. What
is missing is anyone saying what the right answer *was* — and the only participant
who knows that is the assistant that wrote the program.

> Sequenced after `verify-generated-code-at-runtime` and `read-the-screen-as-text`.

## What Changes

- When the assistant writes a program it SHALL be able to state, alongside the
  code, what should be true once that program has run — the values it expects
  named variables to hold, and what it expects to be on the screen.
- After an assistant-driven run, those expectations SHALL be checked against the
  machine and the result reported back to the conversation, through the same
  channel that already carries the run's outcome. A failed expectation is a
  failure the assistant can correct, exactly as a runtime error is.
- What the assistant is asked to check SHALL match what the chosen machine can
  actually answer, so it never states an expectation that cannot be evaluated.
- Expectations SHALL be optional. A reply without them behaves exactly as it does
  today, and no machine becomes unusable for lacking the means to check them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the requirements covering what the assistant returns and what
  flows back from a run both widen — a reply may additionally carry expectations
  about the finished program, and the run outcome reported back includes whether
  those expectations held.

## Impact

- The reply format gains an optional block alongside the existing whole-program
  and fragment blocks, and the extractor that identifies them learns to recognise
  it. Applying code is unaffected: expectations are not program text and are never
  landed in the editor.
- The run-outcome channel added by `verify-generated-code-at-runtime` carries the
  check results; no second channel is introduced.
- The system prompt gains a statement of what this machine can be asked about.
  Variable values are read back as **already-formatted display strings** —
  including the quotes around strings and a rendered form for arrays — so the
  prompt must state that convention or every expectation will be written against
  raw values and fail.
- Coverage is uneven and the prompt has to reflect it: two registered machines
  cannot report variables at all and can only be checked on their screens.
- No dialect, emulator or machine-boundary changes; this consumes what
  `read-the-screen-as-text` and the existing variable readback provide.

## Non-goals

- **A test framework.** These are a handful of expectations about one finished
  run, not a suite, not a runner, and not something the user maintains.
- **Expectations the user writes.** The assistant states them about its own code.
- **Timing, performance or memory assertions.**
- **Graphics or audio comparison.** Characters and variables only.
- **Extending the machine boundary.** Everything needed is already exposed.
- **Deciding the interactive-program question here.** A program waiting for a
  keypress never reaches its expectations; whether checks may script keypresses,
  or whether such programs are simply reported as unverifiable, is settled in
  this change's design rather than assumed now.
