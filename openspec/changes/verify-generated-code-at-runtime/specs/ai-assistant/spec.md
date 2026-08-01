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

Where the machine cannot report its runtime state, no outcome SHALL be reported
and the rest of the assistant SHALL be unaffected.

#### Scenario: Runtime error after AI run

- **WHEN** a program applied and run from the assistant stops with a machine
  error report
- **THEN** that error is reported back to the conversation

#### Scenario: A program that runs without failing

- **WHEN** a program applied and run from the assistant reaches the machine's
  ready state with no error
- **THEN** the conversation reflects that it ran, rather than nothing being
  reported

#### Scenario: A program still running when the check ends

- **WHEN** a program applied and run from the assistant is still running when the
  check ends
- **THEN** it is treated as having run, and no failure is reported

#### Scenario: A machine that cannot report its runtime state

- **WHEN** a program is applied and run from the assistant on a machine that
  cannot report whether it failed
- **THEN** no outcome is reported, and applying and running behave exactly as
  they do on any other machine

#### Scenario: Lint errors after applying

- **WHEN** applying generated code leaves the program with new lint errors
- **THEN** the assistant offers to fix them

## ADDED Requirements

### Requirement: A failed run is corrected without being asked

When a run initiated from the assistant fails with a genuine machine error, the
assistant SHALL be asked to correct it without the user having to request it.

The number of corrections attempted without asking SHALL be bounded and the same
for every machine and every provider. Once that bound is reached the failure
SHALL be offered as a fix the user chooses to accept, rather than attempted
again — so the user is always the one who decides whether to keep going.

The bound SHALL apply to the run being corrected, and SHALL be released when the
user makes a new request, so that a long conversation does not exhaust it.

A correction in progress SHALL be visible as such, and SHALL be stoppable by the
same action that stops any other reply. A correction SHALL NOT begin while the
program it was written against has been changed by the user.

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

#### Scenario: A new request releases the bound

- **WHEN** the user makes a new request after the bound has been reached, and a
  run from that request fails
- **THEN** corrections are attempted again for that run

#### Scenario: Stopping a correction

- **WHEN** the user stops a correction that is in progress
- **THEN** it ends as any other stopped reply does, and no further correction is
  attempted for that run

#### Scenario: The program changed while the run was being checked

- **WHEN** a run fails after the user has edited the program it was written
  against
- **THEN** no correction is attempted without asking

#### Scenario: Applying without running

- **WHEN** the user applies generated code without choosing to run it
- **THEN** the machine does not start, and no run outcome is reported
