## Context

The AI path, the run-a-program path and the point where they meet are described
in `docs/contributing/architecture.md`; the design of
`verify-generated-code-at-runtime` covers the check itself and
`assert-program-results` covers the expectations layered over it. This design
only covers moving the trigger.

What exists is a complete loop with a manual starter motor. An apply-and-run
lands text in the editor and bumps a run request tagged as AI-checked;
`EmulatorPane`'s frame loop watches the machine and hands each frame's readings
to `classifyAiRunFrame`, sampling the assistant's stated expectations on a
cadence; the verdict crosses to `aiStore` as a sequence-tagged outcome, where a
module-level subscription judges a visual expectation, corrects a failure up to a
bound, or folds a clean run into the next request.

Three properties of that arrangement shape everything below.

- **The rules are already pure.** `classifyAiRunFrame`, the expectation latch and
  the finaliser take plain readings and counts; the expectation evaluator takes a
  variables/screen snapshot rather than a machine. None of them care who is
  pumping frames or why. Nothing in this change touches them.
- **`EmulatorPane` is never unmounted.** The editor/preview/AI slots are hidden
  with CSS, not by unmounting, so the machine handle survives an open AI panel and
  the frame loop keeps ticking behind it. A check can run with the chat on screen
  and without a view switch — which is what "in the background" means here.
- **The run effect reads the editor.** It tokenizes the store's `source`, gates on
  the editor's lint count, and refuses with a message rather than an outcome. That
  is the one assumption this change has to break.

## Goals / Non-Goals

**Goals:**

- An answer is run and checked before it is offered, with the user's program
  untouched.
- The user always knows which stage the work is in, including the stages that
  outlast the streamed text.
- One human look at the machine at the end of the loop.
- Identical behaviour across every provider and graceful silence on machines that
  cannot introspect.

**Non-Goals:**

- A second or headless emulator instance.
- Applying anything on the user's behalf.
- Changing what is checked, how it is judged, or the bound on corrections.
- Reshaping the `Dialect` / `MachineEmulator` seam.

## Decisions

### The machine that checks is the machine the user can see

The check restarts the pane's existing emulator with the candidate program,
rather than constructing a second instance to drive headlessly.

The headless route was the obvious one and is genuinely worse here. It needs its
own ROM fetching (the pane's cache is private and several dialects fetch their own
ROM sets regardless of what they are handed), its own virtual filesystem (the
real one is an app-wide singleton the pane clears on every run, so a shared one
would have the check and the user wiping each other's files), and a verdict on
whether the two vendored cores tolerate two live instances. It buys speed —
frames pumped flat out rather than at 50Hz — and isolation from whatever the user
was doing. Since the pane is never unmounted, the visible machine already
provides the isolation that matters, running behind the panel with no view
switch; and speed can be bought back more cheaply (below) without any of the
duplication.

The cost is real and accepted: a check destroys whatever was on the machine. See
the risks.

Alternative rejected: rendering the check into a small preview inside the AI
panel. It makes an invisible thing visible, but the same picture is already
delivered at the end as the human check, and a live thumbnail of a program the
user has not agreed to run is attention the reply should be getting.

### The run request carries the program, instead of naming the editor

This is the whole mechanism. The AI-checked run request grows the candidate
source alongside the expectations and views it already carries, and the run
effect prefers it over the store's `source` when the request is the AI-checked
one. A plain run is untouched and still runs the editor.

The candidate is built with the existing extractor and merge — a declared whole
listing as returned, a declared fragment merged against the source the reply was
written against. No new text manipulation, and the same function that produces
the diff preview produces what gets checked, so the two cannot disagree.

Alternative rejected: applying to the editor, checking, and undoing on failure.
It puts broken code in the document — the exact thing this change exists to stop
— and an undo that races the user's own typing is worse than the problem.

### A block whose kind cannot be established is not checked

The spec already refuses to guess: a block whose declared kind contradicts its
line numbers is "of unknown kind rather than assumed", and the panel offers both
apply actions so the user decides. Checking it would require making exactly the
assumption that rule exists to forbid — and the two readings are not close, since
replacing the program with a fragment discards everything the fragment did not
mention.

So an unknown-kind block is offered as it is today, unchecked. Where a reply
carries several applicable blocks, the last one is checked: a reply builds toward
its answer, and earlier blocks are illustrative far more often than they are the
deliverable.

### The staleness guard has to move from the run to the answer

Today the guard asks whether the program that ran still matches the editor. That
was a correct shortcut while the two were the same thing — the run was of applied
text, so "what ran" and "what the answer was written against" were identical.
Once nothing is applied they diverge permanently, and the shortcut inverts into
"always edited", which would silently disable every unrequested correction.

The spec's wording was already right: a correction must not begin "while the
program it was written against has been changed by the user". So the outcome
carries the base the candidate was derived from alongside the program that ran,
and the guard compares the base. The fingerprint helper and the per-message base
fingerprint the panel uses for its stale-fragment warning already exist for
exactly this comparison.

This is the one change in the whole set that fails silently and passes every
existing test, so it gets a test of its own.

### A candidate that will not build is a failure, not a refusal

The run effect gates on lint and returns with a message. That is right for a user
who pressed Run — they are looking at the editor and the underlines are there.
It is wrong for a check nobody pressed: the outcome never arrives and the loop
waits forever on a verdict that is not coming.

So the candidate is linted before the run is requested, and a failure is routed
into the correction path the applied-code lint failure already uses, spending the
same bounded attempt. Same for a candidate that tokenizes to nothing, and for
memory blocks that conflict with the machine. The assistant then gets told its
program does not tokenize instead of the user discovering it later.

### The status ladder gains stages and outlives the stream

The panel already picks a label from the message's phase flags and renders it
with a spinner — but only while the answer is streaming. Every stage this change
adds happens *after* streaming ends, so the render condition widens and the
message gains a flag for being checked.

| Label | When |
| --- | --- |
| Thinking… | streaming, nothing back yet |
| Writing code… | streaming, content arriving |
| **Checking it on the _machine_…** | the run is armed and being watched |
| **Looking at the screen…** | a judging request is in flight |
| Fixing the failed run… | an automatic correction is streaming |
| Reformatting response… | re-requesting after an empty reply |

"Looking at the screen…" is not merely nice-to-have: a judging request streams
with none of the existing flags set and so currently reads as "Thinking…", which
is the wrong word for showing the model a picture of its own output.

The machine is named because it is what decides how long the wait is. The store's
busy flag has to cover the check as well, so a new request cannot race a
verification in flight, and the existing Stop has to end a check the way it ends
any other stage.

### The final screenshot is display-only, and must not join the wire history

The thread and the outgoing request history are built from the same message
array, and a request carries prior messages' images forward to keep the cached
prefix stable. A user-facing screenshot parked on the existing image field would
therefore be re-sent to the provider on every later turn — paying vision tokens
indefinitely and destabilising the very prefix that carrying images forward
exists to protect.

It gets its own field, excluded from the history mapping, and the exclusion gets
a test. This failure mode is invisible in the UI and shows up only on the user's
bill.

Capture itself needs one adjustment: the pane captures at the verdict only when a
view was asked for or a visual expectation was stated. The human check is
unconditional, so the last attempt of a settled answer always captures.

Persistence inherits the rule already written for shown screens — the marker is
stored, the pixels are not — because the conversation backup shares a few
megabytes of local storage with the autosaved program. That is the right trade
here too: the point is a human looking at it now, not an album.

### Speed is bought with frames per tick, not with a second machine

At 50Hz the check's own windows are up to three seconds of ready emulation and
twelve seconds absolute, per attempt, and an answer can take three attempts.
Nobody is playing the program while it is being checked, so the frame loop can
advance several frames per tick while a check is armed. This is a tuning knob on
the existing loop, not a new execution model, and it leaves the check's rules —
which count frames, not seconds — completely unchanged.

The animation clock is also throttled when the browser tab is in the background,
which would stall not just the picture but the whole assistant loop. A check that
has stopped receiving ticks needs a fallback clock so a backgrounded tab settles
instead of hanging.

### Seam impact: none

Nothing is added to `Dialect` or `MachineEmulator`, and no member changes shape
or meaning. This change consumes the error report, the is-a-program-running
answer, the screen text, the variable readback and the rendered display exactly
as the existing check does. A machine that cannot introspect its error state gets
no check, which is what it gets today.

## Risks / Trade-offs

- **A check destroys what was on the machine.** The user may be mid-game or
  mid-debug when a reply lands. → The check is announced by the status label
  rather than happening silently, the machine is left showing the checked
  program's final state rather than a blank screen, and Run returns to the
  editor's program. A live debug session is the sharper case and is settled
  below rather than left to chance.

- **Every question can now cost several requests.** A reply, a judging request
  and up to two corrections — each correction itself checked and possibly judged.
  → The bound on unrequested corrections is unchanged and still per answer, and
  the judging request is still capped at one per run; what grows is the number of
  runs, not the allowance per run. The user's Stop ends the whole ladder.

- **The checked run and a later applied run can disagree.** Anything driven by
  `RND`, by timing, or by a warm machine may not reproduce. → Accepted. The check
  is a floor on correctness, not a proof, and this was already true of the
  existing check; what changes is that the disagreement can now be noticed,
  because the user sees the screen from the checked run.

- **False failures now cost a turn without anyone having clicked.** On the
  Commodore machines the runtime report is a screen scan for a line containing
  `ERROR`, so a program that prints such a line reads as failing. → Pre-existing
  and unchanged, and still bounded by the correction cap; but it now fires
  unprompted, which is why the human check at the end matters.

- **The status label is load-bearing, not decorative.** Twelve seconds of silence
  after the spinner disappears reads as a hang, and a hang reads as a broken IDE.
  → It is specified as a requirement rather than left to the panel, and it is
  stoppable.

- **An answer nobody applies still consumed a check.** A user who reads a reply
  and discards it paid for a run they never wanted. → It costs machine time, not
  API budget, and the alternative — checking on apply — is what puts broken code
  in the editor. The trade is deliberate.

## Open Questions

None. The one the proposal left open — what a check does to a live debug session
— is settled below.

### Settled: a check ends a live debug session, and says so

A step-through session paused mid-program is state the user built deliberately,
and a check destroys it. Of the three options — defer until the session ends,
skip the check and offer the answer unchecked, or end the session with warning —
the last is taken. Every answer is then checked on the same terms whatever the
machine happened to be doing, which is one rule and one set of tests rather than
a checked path and an unchecked one that drift apart. Deferring was rejected
because a session the user never ends is a check that never runs, and an answer
whose verdict arrives minutes later is worse than one that arrives late.

Two consequences fall out of it, one of them load-bearing:

- **The check must not run in debug mode at all.** The run effect arms a
  step-through session whenever the dialect is debuggable and the machine
  supports it — which is a property of the machine, not of whether the user is
  debugging right now. A check inheriting that would pause on any breakpoint the
  user has set, and a paused loop stops advancing frames, so the classifier would
  never reach a verdict: every reply would hang, for any user with a breakpoint
  anywhere. The check runs its candidate as a plain run with breakpoints not
  armed.
- **Breakpoints outlive the session.** They are line numbers against a program
  the check never modified — the editor is untouched by construction — so they
  stay valid and the user's next run resumes debugging normally. Only the paused
  session and the highlighted line are cleared, which is the teardown a stop
  already performs.
