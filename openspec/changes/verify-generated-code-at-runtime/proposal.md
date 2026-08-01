## Why

The assistant cannot tell whether the code it wrote works. It is told about a
runtime error only when the user presses one particular button, is never told
that a program ran cleanly, and cannot act on either without the user clicking
again. So the loop that ends in working code is closed by the user, one click at
a time, on information the IDE already has.

The machine can already answer the question. Every dialect that can introspect
its error state reports OK, STOP, BREAK and genuine errors through one uniform
shape, and the IDE already watches it for a few seconds after an assistant-driven
run. It simply throws away everything except the first error, and then only
offers it.

## What Changes

- The result of an assistant-driven run becomes a full **outcome**, not just an
  error: the program failed, ended cleanly, is still running, or never started.
  Success reaches the assistant — today a clean run is indistinguishable from no
  run at all.
- A failed run is **fixed without being asked**: the outcome goes back to the
  assistant and it revises, up to a small fixed number of attempts, after which
  the existing offer-a-fix behaviour takes over. Attempts are visible while they
  run and stop when the user stops them.
- Machines that cannot introspect their error state are unchanged: no outcome is
  reported and nothing is retried, exactly as no fix is offered for them today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the existing "Errors flow back into the conversation"
  requirement changes on two points — what flows back (every outcome of an
  assistant-driven run, not only a genuine error) and what happens next (a
  bounded number of automatic corrections before the user is asked).

`program-execution` is unaffected: it already requires the IDE to surface the
running program's runtime report where the machine can introspect it, and this
change consumes that guarantee rather than extending it.

## Impact

- `src/app/store.ts` — the AI-run check flag and the error-only `runReport`
  become an outcome tagged by run sequence.
- `src/components/EmulatorPane.tsx` — the existing frame-window watcher reports
  every terminal state it can distinguish instead of only the first error. Its
  arming comment is corrected in passing: it claims the check is set only by
  "Replace + Run", but both apply-and-run actions share one code path and so
  both already arm it.
- `src/ai/aiStore.ts` — the module-level subscription that today raises a fix
  offer gains a small bounded retry state machine.
- `src/components/AiPanel.tsx` — an automatic correction is visibly in progress
  and interruptible.
- No dialect or emulator code changes; no new dependencies.

## Non-goals

- **Correctness checking.** This change observes whether a program ran, not
  whether it produced the right answer. Asserting on variables and screen output
  is separate later work.
- **Auto-running an apply.** Applying generated code stays a single action;
  a plain merge or replace does not start the machine. Only the
  apply-and-run actions are verified.
- **Tool-calling / function-calling.** The correction is an ordinary follow-up
  turn, so the behaviour is identical across every supported provider.
- **Changing the `Dialect` / `MachineEmulator` seam.** This change only consumes
  what the seam already exposes.
- **An open-ended agentic loop.** The number of automatic attempts is small,
  fixed, and user-interruptible.
