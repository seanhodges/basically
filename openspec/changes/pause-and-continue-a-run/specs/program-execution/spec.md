## ADDED Requirements

### Requirement: A run can be paused and continued

The user SHALL be able to pause a running program and continue it, on every
machine the IDE offers — including machines with no line-level debugger.

A pause SHALL hold the machine still rather than end it. The program's memory,
the files it has written, what its screen was showing and the measurements
taken of it so far SHALL all be as the pause found them when the run carries
on. A pause SHALL NOT be a stop: stopping a paused run SHALL end it exactly as
stopping a running one does.

Continuing SHALL carry the run on from where it was paused, however the pause
was reached. A run paused at a breakpoint SHALL continue to the next
breakpoint; a run the user paused SHALL continue freely, on machines with a
debugger and without one alike.

No emulated time SHALL pass while a run is paused, and none SHALL be repaid as
a burst of accelerated emulation when it continues, so a pause changes no
figure the IDE reports about the program.

A pause SHALL be refused where it would leave the IDE waiting on a run that can
no longer proceed: while the IDE is running a program to check an assistant's
answer, while the assistant is driving the machine itself, and before the
machine has drawn its first frame.

#### Scenario: Pause a running program

- **WHEN** the user pauses a running program
- **THEN** the machine holds its screen, memory and files as they were, and
  stops advancing

#### Scenario: Continue a paused program

- **WHEN** the user continues a program they paused
- **THEN** it carries on from where it was, with the state it had when it was
  paused

#### Scenario: Continue from a breakpoint

- **WHEN** the user continues a program that is paused at a breakpoint
- **THEN** it runs on to the next breakpoint, rather than running freely to the
  end

#### Scenario: Pause on a machine with no debugger

- **WHEN** the user pauses a program running on a machine that offers no
  line-level debugging
- **THEN** the program pauses and can be continued, and no line is reported as
  the paused line

#### Scenario: A pause does not distort the figures

- **WHEN** the user pauses a running program, waits, and continues it
- **THEN** the time spent paused is charged to neither the program nor any of
  its lines, and the machine does not run fast to catch up

#### Scenario: Stopping a paused program

- **WHEN** the user stops a program that is paused
- **THEN** the run ends as stopping a running program does

#### Scenario: A run started to check an assistant's answer

- **WHEN** the IDE is running a program to check an answer the assistant gave
- **THEN** that run cannot be paused, and the check reaches its verdict

### Requirement: The primary run control shows the state of the run

The primary run control over the editor SHALL show which of the three states
the run is in — stopped, running, or paused — and SHALL act on the state it
shows: starting the program when stopped, pausing it when running, and
continuing it when paused.

The control SHALL show the paused state however the pause was reached, so a run
stopped at a breakpoint is offered the same continue as one the user paused.

Carrying a paused run on SHALL be called the same thing wherever it is offered.

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
