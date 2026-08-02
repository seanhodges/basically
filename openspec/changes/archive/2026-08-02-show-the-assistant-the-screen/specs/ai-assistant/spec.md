> **Partially synced, after the fact.** This delta was archived unsynced, and the
> feature was later built to a different design (see the sibling archive
> `2026-08-02-show-the-assistant-the-screen-implemented`). Two guarantees below
> are true of what shipped and have been folded into the baseline: the image is
> the machine's screen at its own resolution, unenlarged, and carrying a screen
> does not change what the assistant is asked to do.
>
> The rest was deliberately NOT synced, because nothing implements it: the
> assistant naming which view or views it wants alongside its code, and an
> outcome reporting a named-but-unproducible view as unavailable. The clause
> requiring the whole behaviour to be identical on every provider was left out
> too — it contradicts the shipped requirement "Being shown the screen is a
> stated capability", under which a provider that cannot take an image degrades
> instead. Treat what follows as a design proposal, not as shipped behaviour.

## MODIFIED Requirements

### Requirement: Errors flow back into the conversation

After applying generated code, new lint errors SHALL prompt an offered fix.

Where a run is initiated from the assistant and the machine can report its
runtime state, the outcome of that run SHALL be reported back to the
conversation — whether the program failed, ended without failing, was still
running when the check ended, or never started. A program still running when the
check ends SHALL be treated as having run, not as having failed, because a
program that never returns to the machine's ready state is the normal shape of a
game or an animation.

Telling a program that has finished from one that is still going requires more
than the failure report, so where the machine can also say whether a program is
executing, the outcome SHALL distinguish the two. Where it cannot, a run that
raises no failure SHALL be reported as having run without failing. Either way no
correction follows, so which of the two is reported SHALL NOT change what the
assistant is asked to do.

A reported outcome MAY additionally carry the machine's screen — as text, as an
image, or as both. Which of these it carries SHALL be the assistant's own
choice: the assistant SHALL be told that both views exist and what each one can
and cannot convey, and MAY name the view or views it wants alongside the code it
returns. The outcome SHALL then carry what was named, and nothing further. Where
the assistant names nothing, the outcome SHALL carry the screen as text alone.

The choice belongs to the assistant because only the assistant knows what it
wrote, and no rule applied to the finished screen distinguishes a program that
printed a table from one that drew a table's border out of graphics characters.

So that the choice can be made well, the assistant SHALL be told which views the
machine in front of it can actually produce. Where it nonetheless names a view
that machine cannot produce, the outcome SHALL report that view as unavailable
rather than silently substituting another, so that a mistaken request is visible
rather than answered with something else.

The image SHALL be the machine's screen at the machine's own resolution and
SHALL NOT be enlarged, so that what the assistant is shown is what the machine
drew and the cost of showing it stays proportional to the machine.

Which views an outcome carries SHALL NOT change what the assistant is asked to
do, and the whole of this behaviour SHALL be the same for every provider.

Where the machine cannot report its runtime state, no outcome SHALL be reported
and the rest of the assistant SHALL be unaffected.

#### Scenario: Runtime error after AI run

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** that error is reported back to the conversation

#### Scenario: A program that runs without failing

- **WHEN** a program applied and run from the assistant reaches the machine's
  ready state with no error, on a machine that can tell a finished program from
  a running one
- **THEN** the conversation reflects that it ran to completion, rather than
  nothing being reported

#### Scenario: A machine that cannot tell finished from still running

- **WHEN** a program applied and run from the assistant raises no failure, on a
  machine that cannot say whether a program is executing
- **THEN** the conversation reflects that it ran without failing, and no
  correction is attempted

#### Scenario: A program still running when the check ends

- **WHEN** a program applied and run from the assistant is still running when the
  check ends
- **THEN** it is treated as having run, and no failure is reported

#### Scenario: The assistant asks to see the screen

- **WHEN** the assistant names the screen image as the view it wants to verify
  with, and the program it returned is applied and run
- **THEN** the outcome carries the screen as an image

#### Scenario: The assistant asks for both views

- **WHEN** the assistant names both the screen text and the screen image
- **THEN** the outcome carries both, so that what was printed and what was drawn
  are reported together

#### Scenario: The assistant asks for nothing in particular

- **WHEN** the assistant returns code without naming any view
- **THEN** the outcome carries the screen as text alone

#### Scenario: The assistant asks for a view this machine cannot produce

- **WHEN** the assistant names a view the running machine cannot produce
- **THEN** the outcome reports that view as unavailable, rather than carrying a
  different view in its place

#### Scenario: The screen is shown as the machine drew it

- **WHEN** an outcome carries the screen as an image
- **THEN** the image is the machine's own screen at its own resolution, neither
  enlarged nor otherwise resampled

#### Scenario: The same on every provider

- **WHEN** an outcome carrying a screen view is reported, on any configured
  provider
- **THEN** the assistant may choose its views and is shown them in the same way,
  rather than the behaviour varying with the provider

#### Scenario: A machine that cannot report its runtime state

- **WHEN** a program is applied and run from the assistant on a machine that
  cannot report whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them
