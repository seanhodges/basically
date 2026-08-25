## MODIFIED Requirements

### Requirement: A run can be paused and continued

On the machines that support line-level debugging, the user SHALL be able to
pause a running program and continue it. Pausing SHALL be offered on exactly
those machines, so that a run can always be released by the same Continue the
machine already offers; a machine that cannot be stepped SHALL NOT offer a
pause.

Wherever the IDE offers to carry a paused run on, it SHALL also offer to pause
a running one. Taking a pause SHALL therefore be reachable on every layout and
from the keyboard, rather than from one layout only, so no user is left able to
release a pause but not to take one.

A pause SHALL hold the machine still rather than end it. The program's memory,
the files it has written, what its screen was showing and the measurements
taken of it so far SHALL all be as the pause found them when the run carries
on. A pause SHALL NOT be a stop: stopping a paused run SHALL end it exactly as
stopping a running one does.

Continuing SHALL carry the run on from where it was paused, however the pause
was reached. A run paused at a breakpoint SHALL continue to the next
breakpoint; a run the user paused SHALL continue freely.

No emulated time SHALL pass while a run is paused, and none SHALL be repaid as
a burst of accelerated emulation when it continues, so a pause changes no
figure the IDE reports about the program.

A pause SHALL be refused where it would leave the IDE waiting on a run that can
no longer proceed: while the IDE is running a program to check an assistant's
answer, while the assistant is driving the machine itself, and before the
machine has drawn its first frame.

Where a run is paused, continuing it SHALL remain available regardless of what
the machine now selected offers, so no pause is left with no way out.

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

#### Scenario: A pause the user took is on no line

- **WHEN** the user pauses a running program away from any breakpoint
- **THEN** the program pauses and can be continued, and no line is reported as
  the paused line

#### Scenario: A pause can be taken wherever one can be released

- **WHEN** a program is running on a machine that offers line-level debugging
- **THEN** every place the IDE would offer to continue that program once paused
  offers to pause it while it runs

#### Scenario: A machine with no debugger offers no pause

- **WHEN** a program is running on a machine that offers no line-level
  debugging
- **THEN** nothing offers to pause or to continue it, and the controls that
  start a program go on offering to run it

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

The primary run control - the control each layout gives the user over the run,
whether that is the single control over the editor on the touch layout, the run
controls on the layout that shows the editor and the machine together, the run
actions offered on the machine's own tab, or the keyboard - SHALL show which of
the three states the run is in - stopped, running, or paused - and SHALL act on
the state it shows: starting the program when stopped, pausing it when running,
and continuing it when paused.

Where the machine offers no pause, the control SHALL go on offering to run the
program, as it does when the run is stopped.

The control SHALL show the paused state however the pause was reached, so a run
stopped at a breakpoint is offered the same continue as one the user paused.

Carrying a paused run on SHALL be called the same thing wherever it is offered,
and holding a running one still SHALL likewise be called the same thing
wherever it is offered.

Carrying a paused run on SHALL be shown distinctly from starting the program
again from the beginning, and SHALL be told apart from it by its mark rather
than by colour alone. The two are the actions it matters most not to confuse:
one resumes the run the user is watching, the other discards it.

Once the program has ended - it finished, or it stopped on an error - the
control SHALL offer to run it again, even though the machine goes on running at
its prompt. Pausing and continuing are offered against a program, and there is
no longer one to hold still or to carry on. This SHALL hold on every machine,
since every machine reports whether a program is running.

Where a surface offers a separate action that always starts the program, its
pause-and-continue control SHALL be refused rather than fall back to starting
the program, so no surface offers to start the same program twice and no
mis-aimed press restarts a run at the moment it ends.

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

#### Scenario: The editor-and-machine layout follows the run

- **WHEN** a program runs and is then paused on the layout that shows the
  editor and the machine side by side
- **THEN** the run control there offers to pause the program while it runs and
  to continue it once paused, presented as the same control the touch layout
  shows

#### Scenario: The machine's own tab follows the run

- **WHEN** the user opens the run actions from the machine's tab while a
  program is running
- **THEN** they are offered a pause there, and a continue once the program is
  paused

#### Scenario: The keyboard takes and releases a pause

- **WHEN** the user presses the key that continues a paused program while a
  program is instead running
- **THEN** the program pauses, and pressing it again carries the run on

#### Scenario: Continuing is not mistaken for starting over

- **WHEN** a surface offers both to start the program and to carry a paused run
  on
- **THEN** the two are marked differently, so a user who cannot rely on colour
  can still tell which one resumes the run they are watching

#### Scenario: A surface with its own start action refuses rather than restarts

- **WHEN** no program is running or paused on a surface that offers a separate
  action to start one
- **THEN** that surface's pause-and-continue control is shown refused, rather
  than offering to start the program a second way
