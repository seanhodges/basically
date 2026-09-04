## ADDED Requirements

### Requirement: The assistant states expectations in the vocabulary every caller writes

What the assistant states about its own program SHALL be written in the same
vocabulary any other caller of this toolchain writes an expectation in, rather
than one of its own. A file of expectations written by one caller SHALL mean the
same thing to the other, and an expectation SHALL be evaluated the same way
whoever wrote it, so that two callers cannot reach different verdicts about the
same program.

One form SHALL remain the assistant's alone: an expectation about how the screen
looks, which is settled by showing the assistant the display and asking it to
judge its own program. Nothing but the assistant can settle one, so this SHALL be
a declared asymmetry with that as its reason, and another caller meeting one
SHALL report it as unevaluated rather than refusing the file.

Expectations already recorded in a saved conversation SHALL stay readable when
that conversation is restored, whatever vocabulary they were written in. A
restored expectation SHALL NOT be reported as malformed for having been written
before the vocabulary changed.

#### Scenario: The same expectation written by either caller

- **WHEN** the same expectation about the same program is written once by the
  assistant and once by another caller
- **THEN** both are evaluated the same way and reach the same verdict

#### Scenario: An expectation only the assistant can settle

- **WHEN** an expectation about how the screen looks reaches a caller that cannot
  show a display to anyone
- **THEN** it is reported as unevaluated, and the file it came in is not refused

#### Scenario: Restoring a conversation written in the earlier vocabulary

- **WHEN** the user restores a conversation whose expectations were written
  before the vocabulary changed
- **THEN** those expectations are still read as expectations, and none is
  reported as malformed

## MODIFIED Requirements

### Requirement: Stated expectations are checked against the run

Where the assistant has stated expectations and the IDE runs the program it
returned, those expectations SHALL be checked and the result SHALL be reported
back to the conversation alongside the run's outcome.

An expectation SHALL be judged at the moment the assistant names. An expectation
that names no moment SHALL be judged as the run was observed. Text that appears
during a run and is then replaced SHALL be expressed by waiting for it, which
already means "run until this appears, and fail if it never does", rather than by
the IDE remembering on the assistant's behalf whether something was ever true.
The assistant SHALL be told this, so that an expectation about something
transient is written with the wait it needs rather than silently becoming an
expectation about the end of the run.

Expectations the machine can evaluate SHALL be evaluated from the machine.
Expectations about how the screen looks SHALL be settled by showing the assistant
the display as it stood when the run was observed and asking it to judge its own
program against what it stated; the judgement SHALL be visible in the
conversation as something the IDE asked for rather than something the user did.

An expectation that does not hold SHALL be treated as a failure of that run, and
SHALL be correctable on the same terms as a runtime error — including the bound
on corrections attempted without asking. Where an expectation about how the
screen looks does not hold, the assistant SHALL be asked to correct the program
without the user having to request it, on those same terms.

An expectation that cannot be evaluated SHALL be reported as unchecked rather
than as passed or failed. An expectation about how the screen looks SHALL be
reported as unchecked when there is no display to show or the chosen provider
cannot be shown one — never as passed, and never as a failure of the program.

#### Scenario: The program produces the wrong answer

- **WHEN** a program runs without error but a stated expectation does not hold
- **THEN** the run is reported as failed and the assistant is asked to correct it

#### Scenario: The program produces the right answer

- **WHEN** a program runs and every stated expectation holds
- **THEN** the run is reported as having succeeded

#### Scenario: Text that appears and is then replaced

- **WHEN** the assistant expects text its program prints and then clears, and it
  waits for that text before expecting it
- **THEN** the expectation holds, and the run is reported as having succeeded

#### Scenario: An expectation about the end of a run that names no moment

- **WHEN** the assistant states an expectation without naming when it should hold
- **THEN** it is judged as the run was observed

#### Scenario: The program draws the wrong thing

- **WHEN** a program runs without error, the assistant is shown the display, and
  it judges that what it stated the screen would look like does not hold
- **THEN** the run is reported as failed and the assistant is asked to correct
  the program without the user requesting it

#### Scenario: The program draws what was stated

- **WHEN** a program runs and the assistant, shown the display, judges that what
  it stated holds
- **THEN** the run is reported as having succeeded, and no correction is
  attempted

#### Scenario: An expectation that cannot be evaluated

- **WHEN** an expectation cannot be checked on the machine the program ran on
- **THEN** it is reported as unchecked, and neither passed nor failed

#### Scenario: Nothing to judge a visual expectation against

- **WHEN** the assistant stated how the screen should look but the display
  cannot be shown to the chosen provider
- **THEN** that expectation is reported as unchecked, and the run is not failed
  because of it

#### Scenario: Expectations are checked without the user applying anything

- **WHEN** the assistant returns a program that states expectations
- **THEN** those expectations are checked against the run the IDE started, with
  the program in the editor unchanged
