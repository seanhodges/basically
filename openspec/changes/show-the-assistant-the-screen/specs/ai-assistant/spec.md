## ADDED Requirements

### Requirement: The user can show the assistant the screen

The user SHALL be able to attach the machine's current display to a request they
are writing, so a question about what the program does can be asked against what
the program actually shows.

What is attached SHALL be the display as it stood when the user attached it, and
the thread SHALL show that a screen was attached and what it showed, so a
conversation can be read back without ambiguity about what the assistant was
looking at.

Attaching SHALL be optional and reversible before sending: a request with nothing
attached behaves exactly as a request does today, and an attachment can be
removed before the request is sent.

Attaching SHALL be offered only when there is a display to attach and only when
the chosen provider can be shown one; otherwise it SHALL be presented as
unavailable rather than failing when used.

#### Scenario: Asking about what is on the screen

- **WHEN** the user attaches the machine's display to a request and sends it
- **THEN** the assistant answers with that display available to it, and the
  thread records that the screen was shown

#### Scenario: Removing an attachment before sending

- **WHEN** the user attaches the display and then removes it before sending
- **THEN** the request is sent with no screen attached, and behaves as any
  ordinary request does

#### Scenario: Nothing to show

- **WHEN** the user opens the assistant with no machine display available to
  attach
- **THEN** attaching is presented as unavailable, and every other part of the
  assistant remains usable

### Requirement: A failed run shows the assistant the screen

Where a run initiated from the assistant is checked and that check ends in a
failure, the display as it stood when the failure was settled SHALL be shown to
the assistant along with the correction request, so the correction is made
against what the machine displayed and not against the program text alone.

A run that did not fail SHALL NOT carry a display, so the ordinary working case
costs nothing.

Where there is no display to carry, or the chosen provider cannot be shown one,
the correction SHALL proceed exactly as it does today with the failure described
in words alone.

#### Scenario: A runtime error on a machine that can be shown

- **WHEN** a program applied and run from the assistant stops with a machine
  error report, and the chosen provider can be shown an image
- **THEN** the correction request carries the display as it stood at that
  failure

#### Scenario: A run that did not fail

- **WHEN** a program applied and run from the assistant runs without failing and
  every stated expectation holds
- **THEN** no display is sent, and the outcome is reported as it is today

#### Scenario: A provider that cannot be shown a screen

- **WHEN** a run fails and the chosen provider cannot be shown an image
- **THEN** the correction is requested with the failure described in words, and
  the correction loop is otherwise unchanged

### Requirement: Being shown the screen is a stated capability

Whether the assistant can be shown the machine's display SHALL be a stated
property of the chosen provider rather than something discovered by attempting
it. Where a provider cannot be shown one, the IDE SHALL NOT send a display to it
and SHALL NOT present showing it as available; every other part of the assistant
SHALL behave identically on such a provider.

#### Scenario: Switching to a provider that cannot be shown a screen

- **WHEN** the user selects a provider that does not accept images
- **THEN** attaching the screen is presented as unavailable, no display is sent
  on any request, and the assistant otherwise works exactly as before

### Requirement: A shown screen is not retained

A display shown to the assistant SHALL be sent only to the provider the user
chose, and SHALL be held no longer than the request that carries it needs.

The saved conversation SHALL record that a screen was shown without retaining
the display itself, so restoring a thread never depends on stored image data and
never restores it.

#### Scenario: Reloading a conversation in which a screen was shown

- **WHEN** the user reloads the IDE on a program whose conversation included a
  shown screen
- **THEN** the thread still shows that a screen was shown at that point, and the
  display itself is not restored

## MODIFIED Requirements

### Requirement: The assistant states what its program should produce

When the assistant returns a program it MAY additionally state what should be
true once that program has run — the values it expects named variables to hold,
what it expects to be on the screen, and how it expects the screen to look. What
it is asked to state SHALL be limited to what can be evaluated for the chosen
machine and the chosen provider, so it never states an expectation that cannot be
evaluated: it SHALL NOT be asked to state expectations about variables on a
machine that cannot report them, and SHALL NOT be asked to state expectations
about how the screen looks where the display cannot be shown to it.

An expectation about how the screen looks SHALL be a description of what the
program is meant to have drawn — one the assistant itself can judge by being
shown the display — and is distinct from expecting particular text to appear,
which the machine reports for itself.

Expectations SHALL be optional: a reply that states none behaves exactly as a
reply does today, and no machine becomes unusable for being unable to report
them.

Expectations SHALL NOT be program text. They SHALL never be applied to the
editor, and applying generated code SHALL be unaffected by their presence.

#### Scenario: A program with a computable result

- **WHEN** the assistant returns a program whose result the machine can report
- **THEN** it may also state what that result should be

#### Scenario: A program that draws something

- **WHEN** the assistant returns a program that draws, on a setup where the
  display can be shown to it
- **THEN** it may also state how the screen should look once the program has run

#### Scenario: A machine that cannot report what an expectation needs

- **WHEN** the assistant writes for a machine that cannot report its variables
- **THEN** it is not asked to state expectations about variables

#### Scenario: A provider that cannot be shown the screen

- **WHEN** the assistant writes for a setup whose provider cannot be shown the
  display
- **THEN** it is not asked to state expectations about how the screen looks

#### Scenario: Applying a reply that carries expectations

- **WHEN** the user applies generated code from a reply that also states
  expectations
- **THEN** only the program is applied, and the expectations do not appear in the
  editor

### Requirement: Stated expectations are checked against the run

Where the assistant has stated expectations and a run is initiated from the
assistant, those expectations SHALL be checked once the run has been observed,
and the result SHALL be reported back to the conversation alongside the run's
outcome.

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

### Requirement: A failed run is corrected without being asked

When a run initiated from the assistant fails with a genuine machine error, the
assistant SHALL be asked to correct it without the user having to request it.

The number of corrections attempted without asking SHALL be bounded and the same
for every machine and every provider. Asking the assistant to judge its own
program against the display it produced SHALL be counted against that same
bound, so being shown the screen cannot make a failing program cost more
unrequested requests than it does today. Once the bound is reached the failure
SHALL be offered as a fix the user chooses to accept, rather than attempted
again — so the user is always the one who decides whether to keep going.

The bound SHALL apply to the run being corrected, and SHALL be released when the
user makes a new request, so that a long conversation does not exhaust it.

A correction in progress SHALL be visible as such, and SHALL be stoppable by the
same action that stops any other reply; a judgement in progress SHALL be visible
and stoppable on the same terms. A correction SHALL NOT begin while the program
it was written against has been changed by the user.

Applying generated code SHALL remain a single action: code that is applied
without being run SHALL NOT cause the machine to start.

#### Scenario: A program that fails at runtime

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** the assistant is asked to correct that error without the user
  requesting it

#### Scenario: Corrections that keep failing

- **WHEN** the corrected program fails again, until the bound on unrequested
  corrections is reached
- **THEN** no further correction is attempted, and the failure is offered as a
  fix for the user to accept

#### Scenario: Judging counts against the bound

- **WHEN** the assistant is asked to judge its program against the display it
  produced
- **THEN** that request is counted against the same bound on requests made
  without the user asking

#### Scenario: A new request releases the bound

- **WHEN** the user makes a new request after the bound has been reached, and a
  run from that request fails
- **THEN** corrections are attempted again for that run

#### Scenario: Stopping a correction

- **WHEN** the user stops a correction that is in progress
- **THEN** it ends as any other stopped reply does, and no further correction is
  attempted for that run

#### Scenario: Stopping a judgement

- **WHEN** the user stops a judgement that is in progress
- **THEN** it ends as any other stopped reply does, the run is not failed because
  of it, and no correction follows

#### Scenario: The program changed while the run was being checked

- **WHEN** a run fails after the user has edited the program it was written
  against
- **THEN** no correction is attempted without asking

#### Scenario: Applying without running

- **WHEN** the user applies generated code without choosing to run it
- **THEN** the machine does not start, and no run outcome is reported
