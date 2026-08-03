## Why

The assistant can already run its own program, read the machine's error report,
check what it said the program would produce, look at the screen it drew, and
correct itself. All of it waits on one click. Nothing is checked until the user
presses an apply-and-run button — so the checking happens *with the unverified
program already in the user's editor*, and a program that needed two corrections
sat there broken for both of them.

The user is being asked to be the trigger for work the IDE can do by itself, and
paying for it with their document.

## What Changes

- A reply that carries code SHALL be **run and checked as soon as it arrives**,
  without the user asking and **without the code reaching the editor**. What runs
  stops being "whatever is in the editor" and becomes the candidate program the
  reply proposes — for a fragment, the fragment merged against the program as it
  stood.
- The **apply-and-run buttons stop arming a check**. By the time they are
  offered, the answer has already been run; applying and running is an ordinary
  run again. Applying stays entirely the user's decision — this change makes
  verification automatic, not application.
- What the assistant is **doing while the user waits SHALL be stated**. Today the
  panel says it is thinking and then goes silent for as long as the machine takes;
  a run being watched, and a screen being looked at, become named stages
  alongside the ones already named.
- When the loop settles — whether it converged, gave up, or was stopped — the
  user SHALL be **shown the machine's screen, once**, for a human look at what
  was actually produced. This is shown to the user and never sent to the
  provider.
- Everything below the trigger is unchanged: the same four run outcomes, the
  same expectation grammar, the same bound on unrequested corrections, the same
  single judging request per run, the same Stop.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: four requirements change on the same seam — the trigger.
  "Errors flow back into the conversation", "A failed run is corrected without
  being asked" and "Stated expectations are checked against the run" are all
  written against a run the user started by applying; they become written
  against a run the IDE starts from the reply. Two additions ride with it: what
  the assistant is doing is stated stage by stage, and the finished work is shown
  to the user as the machine drew it. "A shown screen is not retained" is
  clarified rather than changed — it governs a screen sent to a provider, and the
  screen shown to the user never leaves the browser.

`program-execution` is **not** modified. Its requirements govern the user's Run
action — one action taking the editor's source to a running program, gated on
known-bad input, with runtime state surfaced where the machine can introspect it.
None of that changes. The assistant driving the machine to check its own work is
already `ai-assistant` behaviour today; this change alters when it starts, not
what the machine owes anybody.

## Impact

- The run request grows a way to say *run this text*, distinct from the editor's
  source. This is the whole mechanism; everything else follows from it.
- The staleness rule that decides whether a correction may proceed has to be
  restated. It currently asks whether the program that ran still matches the
  editor — which, once nothing is applied, is never true. It must ask whether the
  program the candidate was *derived from* still matches.
- A candidate that does not tokenize currently reports nothing at all, because
  the run is refused before the machine is reached. It has to become a failure
  the assistant is told about, on the same terms as any other.
- The emulator now shows a program the editor does not contain, which the user
  has to be able to see and to leave.
- No dialect, emulator, or machine-boundary change. This consumes the error
  report, the run-state answer, the screen text, the variable readback and the
  rendered display exactly as the existing check does.
- No new dependencies.

## Non-goals

- **A second or headless emulator.** The machine the user can see is the machine
  that checks, restarted per attempt. Nothing is added that runs invisibly.
- **Auto-applying.** What lands in the editor stays the user's choice, made after
  seeing an answer that has already been run. The change removes a click that was
  buying verification, not the click that commits.
- **Changing what is checked.** The expectation grammar, the four outcomes, the
  latch rules, the correction bound and the one-judgement-per-run limit are all
  as they are.
- **Verifying anything but an assistant reply.** A program the user wrote is
  their business; the Run action is unchanged.
- **Scripting input.** A program waiting on a keypress still never reaches its
  result and its expectations still report as unchecked.
- **Tool-calling.** The loop stays ordinary turns, identical across providers.
- **Reshaping the `Dialect` / `MachineEmulator` seam.** Nothing is added,
  removed, or altered.
- **Retaining screens.** The screen shown to the user is not a gallery and not a
  history; it is one look at the end of one loop.
