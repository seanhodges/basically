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

A reported outcome MAY additionally carry the machine's screen as an image.
Because what a program drew is not always expressible as characters, the outcome
SHALL carry the image where the program produced output the screen text cannot
convey — a screen holding no text, or only the block characters that stand in
for graphics, after a program that ran. It SHALL also carry the image where the
machine cannot report its screen as text at all, that being the only account of
the screen available for such a machine. Where the screen text does convey what
the program produced, the outcome SHALL NOT carry an image, so that the exact
account is preferred to the depicted one.

The image SHALL be the machine's screen at the machine's own resolution and
SHALL NOT be enlarged, so that what the assistant is shown is what the machine
drew and the cost of showing it stays proportional to the machine.

Whether an outcome carries an image SHALL NOT change what the assistant is asked
to do, and SHALL be the same for every provider.

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

#### Scenario: A program whose output is graphical

- **WHEN** a program applied and run from the assistant leaves the screen holding
  no text, or only the block characters that stand in for graphics
- **THEN** the outcome carries the screen as an image, so that what was drawn
  reaches the conversation

#### Scenario: A program that printed its answer

- **WHEN** a program applied and run from the assistant leaves text on the screen
  that conveys what it produced
- **THEN** the outcome carries that text and no image

#### Scenario: A machine that cannot report its screen as text

- **WHEN** a program is applied and run from the assistant on a machine that
  cannot determine its screen text
- **THEN** the outcome carries the screen as an image, that being the only
  account of the screen available

#### Scenario: The screen is shown as the machine drew it

- **WHEN** an outcome carries the screen as an image
- **THEN** the image is the machine's own screen at its own resolution, neither
  enlarged nor otherwise resampled

#### Scenario: The same on every provider

- **WHEN** an outcome carrying an image is reported, on any configured provider
- **THEN** the assistant is shown the screen and asked to do the same thing,
  rather than the behaviour varying with the provider

#### Scenario: A machine that cannot report its runtime state

- **WHEN** a program is applied and run from the assistant on a machine that
  cannot report whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them
