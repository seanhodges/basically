## Context

See `docs/contributing/architecture.md` for the seam and the headless toolchain,
and `share-one-interface-across-callers` for the operation layer, the machine
session and the parity guarantee this change depends on.

What is left to settle is narrow and specific. Two vocabularies exist for one
question — what should be true of a program once it has run. The assistant
states its own in a block beside the code it returns, evaluated after a run
against readings taken while that run happened. The command line has none, and
the withdrawn proposal would have given it a second one, read by the same parser
the assistant drives with, evaluated inline as a schedule runs.

They are close. Both say "this text should be on screen" and "the program should
have stopped". They differ in three ways that matter, and this document is about
those three.

**Impact on the `Dialect` / `MachineEmulator` seam: none.** Every reading an
expectation needs — the characters on screen, whether the program is running,
what a variable holds — is already reachable, and the machine session
`share-one-interface-across-callers` introduces is where they meet. Nothing is
added.

## Goals / Non-Goals

**Goals:**

- One vocabulary for what a program should do, written the same way by whoever
  writes it.
- A verdict that can be trusted: a failure names the expectation, its line, and
  the screen as it stood.
- One evaluation path, so the two callers cannot come to different verdicts
  about the same program.
- The one form only a model can settle declared rather than quietly dropped.

**Non-Goals:**

- Several scenarios in one file; a picture from a check; changing what a failed
  expectation asks of the assistant. See the proposal.
- Reopening the operation layer or the parity guarantee.

## Decisions

### The three real differences, and what happens to each

**One — spelling.** The assistant says `SCREEN CONTAINS "<text>"`; the withdrawn
proposal said `EXPECT "<text>"`. Nothing turns on which survives. `EXPECT` wins
because the vocabulary it joins is already imperative and one word per line
(`PRESS`, `JOY`, `WAIT`), and because `SCREEN CONTAINS` names the subject of only
one of the forms — a variable expectation is not about the screen.

| Line                       | Meaning                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `EXPECT "<text>"`          | Fails unless the text is on screen now — matched a row at a time, spaces collapsed, as waiting for text is. |
| `EXPECT NOT "<text>"`      | Fails if the text is on screen now.                                                            |
| `EXPECT STOPPED`           | Fails unless the program has stopped.                                                          |
| `EXPECT RUNNING`           | Fails unless the program is still running.                                                     |
| `EXPECT VAR <name> = <value>` | Fails unless the variable holds that value.                                                 |
| `EXPECT SHOWS <description>`  | Judged by showing the screen to the assistant. Only it can settle one.                      |

An expectation is a step that costs no frames and fails the script the way a
timed-out wait does, so the existing rule — stop at the first failure, because
everything after it was written for a screen that never arrived — covers it
without a second loop or a second report shape.

**Two — when an expectation is judged.** This is the substantive one. The
assistant samples the screen throughout a run and remembers whether something was
ever true, because a program that prints its answer and then clears the screen
would fail an end-of-run check that was really asking "did it print this". The
command line's expectations ask "is this true now", at the point in the schedule
where they are written.

These unify without a new form, because the vocabulary already contains the
other meaning: waiting for text is exactly "run until this appears, and fail if
it never does". So "it printed this at some point" is a wait, and "this is on
screen now" is an expectation, and the caller says which it means instead of one
caller assuming each.

*Alternative rejected: keep the latch and give expectations a second, remembering
form.* It would preserve today's assistant behaviour exactly, at the cost of two
forms whose difference is invisible on the page and which need explaining to
every caller forever. The wait already says it.

*Consequence, accepted:* an assistant expectation that used to pass by latching
now needs a wait in front of it, and the rules it is given must say so. This is
the behavioural change in this proposal and the thing its tests exist to pin.

**Three — a form no machine can evaluate.** `SHOWS` is settled by showing the
assistant a picture of the screen and asking whether its own program did what it
said. A command line has nobody to ask. It is therefore declared in the parity
table as available to the assistant alone, with that as the reason — the first
entry in that table that is a fact about the world rather than about work not yet
done.

A file of expectations containing one is not an error on the command line; it is
reported as unevaluated, on the same terms as any other expectation that was
never reached. Silently passing it would be a claim, and failing it would fail
correct programs.

### A file of expectations is a schedule, not a second format

It is the same line-per-action script a run can already be given, with
expectations mixed in. Nothing distinguishes a schedule that checks something
from one that does not, and a run given a file with an expectation in it fails
if that expectation does not hold, which is the same everything-else behaviour.

*Alternative rejected: a structured file, YAML or JSON, with steps and
expectations as data.* The structure it would carry — which program, which
machine — is already on the command line, so it buys a second parser, a second
vocabulary to teach, and for YAML a dependency, in exchange for nothing a
comment line does not already give.

### Whose fault a failure is

A failing expectation is the program's failure: the program did not do what was
written. A file that cannot be read, or a line the parser cannot understand, is
the caller's mistake, refused before any machine starts. The command line's
existing split between those two outcomes carries this without extension.

A check requires the machine's ROM and refuses its absence as the caller's
mistake before anything runs, because a verdict from a machine that ran nothing
says nothing about the program.

### Saved conversations stay readable

The assistant's saved threads contain expectations in the old spelling. Reading
one back must not report it as malformed, so the old forms stay accepted while
only the new ones are taught. This is the same courtesy the key-name vocabulary
was given when it replaced the per-machine names: accept what is already written,
teach only what is current.

## Risks / Trade-offs

**The assistant's expectations get weaker without it noticing** → Losing the
latch means an expectation about something transient now needs a wait before it.
The rules it is given say so, and a test pins the case: a program that prints and
clears, with and without the wait.

**A verdict that differs between callers** → One evaluation path is the
mitigation, and the test that matters runs the same file against the same program
through both callers and asserts the same verdict.

**`SHOWS` on the command line reads as a silent pass** → It is reported as
unevaluated and counted as such in the verdict, never folded into the pass.

**Old expectations linger forever** → Accepted while conversations that contain
them can still be restored. Whether the old spellings are eventually retired is
a question for whenever saved threads stop being carried across.

## Open Questions

- **Whether a variable expectation can be judged mid-schedule on every machine**,
  or only once a program has stopped. Reading variables while BASIC is running is
  not something every machine's introspection was built for, and the answer may
  be that the form is refused mid-run rather than reported wrong.
- **What a check reports when a program never reaches an expectation at all** —
  the assistant already distinguishes "unchecked" from "failed", and the command
  line's verdict needs the same third outcome rather than folding it into either.
