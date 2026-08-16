## ADDED Requirements

### Requirement: Every machine reports whether a program is running

Every machine the IDE runs SHALL report whether a BASIC program is executing.
This is not a figure a machine may decline to produce: a machine that cannot
answer it cannot be run by the IDE.

A machine SHALL report that a program is running from the point it has taken the
program until the point its BASIC has stopped running it, and SHALL report that
none is running thereafter. Before it has taken the program — while it is still
booting, or still being handed the program — it SHALL report that the question is
not yet answerable, so that the interval between being given a program and
starting it is never read as the program having finished.

A machine SHALL reach a definite answer within a bounded time of being handed a
program that terminates. Reporting "not yet answerable" indefinitely SHALL NOT
satisfy this requirement.

A program waiting for the user to type something SHALL be reported as running.
Waiting for input is what the program is doing, not evidence that it has
stopped.

#### Scenario: A program that finishes

- **WHEN** a program runs to its end on any machine
- **THEN** that machine reports that no program is running, within a bounded
  time of the program ending

#### Scenario: A program that keeps going

- **WHEN** a program loops indefinitely
- **THEN** the machine goes on reporting that a program is running

#### Scenario: A program waiting for input

- **WHEN** a program stops at a prompt for the user to type a value
- **THEN** the machine reports that a program is running, not that it has
  finished

#### Scenario: A program stopped by the user at the machine

- **WHEN** the user interrupts a running program using the machine's own
  interrupt key
- **THEN** the machine reports that no program is running

#### Scenario: The machine has not started the program yet

- **WHEN** the IDE has handed a machine a program but the machine has not begun
  running it
- **THEN** the machine reports that the question is not yet answerable, rather
  than reporting that no program is running

#### Scenario: A program that ends immediately

- **WHEN** a program finishes as soon as it starts, before the machine has been
  observed running it
- **THEN** the machine still reports that no program is running, rather than
  reporting the question unanswerable indefinitely

## MODIFIED Requirements

### Requirement: The primary run control shows the state of the run

The primary run control over the editor SHALL show which of the three states
the run is in — stopped, running, or paused — and SHALL act on the state it
shows: starting the program when stopped, pausing it when running, and
continuing it when paused.

Where the machine offers no pause, the control SHALL go on offering to run the
program, as it does when the run is stopped.

The control SHALL show the paused state however the pause was reached, so a run
stopped at a breakpoint is offered the same continue as one the user paused.

Carrying a paused run on SHALL be called the same thing wherever it is offered.

Once the program has ended - it finished, or it stopped on an error - the
control SHALL offer to run it again, even though the machine goes on running at
its prompt. Pausing and continuing are offered against a program, and there is
no longer one to hold still or to carry on. This SHALL hold on every machine,
since every machine reports whether a program is running.

#### Scenario: The control follows a run it started

- **WHEN** the user starts a program from the run control over the editor
- **THEN** that control offers to pause the program while it runs, and to
  continue it once paused

#### Scenario: The control follows a breakpoint pause

- **WHEN** a debugged program stops at a breakpoint
- **THEN** the run control over the editor offers to continue it

#### Scenario: The control does not restart a running program

- **WHEN** the user uses the run control over the editor while a program is
  running
- **THEN** the program pauses, rather than restarting from the beginning

#### Scenario: The control follows the program to its end

- **WHEN** a program the user is watching finishes, leaving the emulator at its
  prompt
- **THEN** the run control over the editor offers to run the program again,
  rather than going on offering to pause a program that has ended

#### Scenario: The control returns to the program on every machine

- **WHEN** a program ends on any registered machine
- **THEN** the run control over the editor offers to run the program again,
  without the user having to stop the run first
