## MODIFIED Requirements

### Requirement: Errors flow back into the conversation

After applying generated code, new lint errors SHALL prompt an offered fix.

Where the IDE runs a program the assistant returned and the machine can report
its runtime state, the outcome of that run SHALL be reported back to the
conversation — whether the program failed, ended without failing, was still
running when the check ended, or never started. That run SHALL happen whether or
not the user has applied the code, and SHALL NOT require the user to ask for it.
A program still running when the check ends SHALL be treated as having run, not
as having failed, because a program that never returns to the machine's ready
state is the normal shape of a game or an animation.

A program that has finished SHALL be distinguished from one that is still going,
on every machine, since every machine reports whether a program is executing.
Which of the two is reported SHALL NOT change what the assistant is asked to do:
no correction follows either.

A reported outcome MAY additionally carry the machine's screen, as text or as an
image or as both. Where it carries an image, that image SHALL be the machine's
screen at the machine's own resolution and SHALL NOT be enlarged, so that what
the assistant is shown is what the machine drew and the cost of showing it stays
proportional to the machine.

Which views an outcome carries SHALL NOT change what the assistant is asked to
do.

Where the machine cannot report its runtime state, no outcome SHALL be reported
and the rest of the assistant SHALL be unaffected.

#### Scenario: Runtime error after an assistant's program is run

- **WHEN** a program the assistant returned stops with a machine error report
- **THEN** that error is reported back to the conversation

#### Scenario: A program that runs without failing

- **WHEN** a program the assistant returned reaches the machine's ready state with
  no error
- **THEN** the conversation reflects that it ran to completion, rather than
  nothing being reported

#### Scenario: A program still running when the check ends

- **WHEN** a program the assistant returned is still running when the check ends
- **THEN** it is treated as having run, and no failure is reported

#### Scenario: The screen is shown as the machine drew it

- **WHEN** an outcome carries the screen as an image
- **THEN** the image is the machine's own screen at its own resolution, neither
  enlarged nor otherwise resampled

#### Scenario: A screen does not change the request

- **WHEN** an outcome carries the screen as well as how the run went
- **THEN** what the assistant is asked to do is what the outcome alone would have
  asked of it

#### Scenario: A machine that cannot report its runtime state

- **WHEN** the assistant returns a program for a machine that cannot report
  whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them
