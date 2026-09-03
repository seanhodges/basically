## ADDED Requirements

### Requirement: A run can be told what to press and when

The user SHALL be able to give a run a schedule of actions to carry out once the
program is loaded: press named keys, together where a chord is wanted; hold a
joystick control; let the program run for a number of frames; run until named
text is on the screen, with a cap on the wait; and run until the program stops,
with a cap on the wait. The actions SHALL be carried out in order, and the run
SHALL end when the schedule ends, so that the screen reported is the one the
last action left; the user SHALL be able to ask for a number of further frames
after it. A schedule the tool cannot read SHALL be reported as the caller's
mistake, naming the line, before any machine is started. An action that cannot
be carried out — text that never appears, a program that never stops — SHALL end
the schedule there, and the run SHALL report which action failed and why, still
report the screen as it stood, and count as the program's failure.

#### Scenario: Getting past a prompt

- **WHEN** the user runs a program that waits for a keypress, with a schedule
  that waits for the prompt, presses a key, and waits for the text the program
  then prints
- **THEN** the screen reported holds that text, and the run succeeds

#### Scenario: A wait that runs out

- **WHEN** a schedule waits for text the program never prints
- **THEN** the run reports that action as the one that failed and why, reports
  the screen as it stood when the wait ran out, and fails with the outcome
  reserved for a program at fault

#### Scenario: A schedule that cannot be read

- **WHEN** the user gives a schedule containing a line that is not an action
- **THEN** the run is refused as the caller's mistake, naming the line, and no
  machine is started

### Requirement: Keys are named the same way on every machine

A schedule SHALL name keys in a vocabulary that does not depend on the machine:
every letter, every digit, and the keys machines have in common — space, enter,
shift, delete, escape, the cursor keys and the function keys — SHALL be written
the same way for every registered machine, and each machine SHALL resolve a name
to whatever its own keyboard calls that key. Where machines name one key
differently from one another, the common names SHALL be accepted as one. A
machine's own key names SHALL also be accepted. A name that a machine has no key
for SHALL be refused, naming the machine and the key, rather than resolved to
some other key. Describing a machine SHALL list the names it answers to.

#### Scenario: One schedule, two machines

- **WHEN** the user runs the same schedule, naming a letter, a digit, space and
  enter, on two different registered machines
- **THEN** each machine presses its own key for each name, and neither refuses
  any of them

#### Scenario: A key the machine does not have

- **WHEN** a schedule presses a key the machine's keyboard has no equivalent of
- **THEN** the action fails, naming the machine and the key, and no other key is
  pressed in its place

#### Scenario: Finding out what may be pressed

- **WHEN** the user asks for a machine's description
- **THEN** it lists the key names that machine answers to

### Requirement: A program's behaviour can be checked against a written expectation

The user SHALL be able to run a program against a written expectation — the
same actions a schedule may hold, together with expectations that named text is
on the screen, that named text is not on the screen, that the program has
stopped, or that it is still running — and receive a pass or a failure. The
check SHALL pass only when every action is carried out and every expectation
holds. It SHALL fail at the first that does not, and SHALL report which
expectation or action it was, by its line, what was expected, and what the
screen actually held at that moment. A failure SHALL count as the program's
failure, distinct from an expectation the tool cannot read, which SHALL be the
caller's mistake and refused before the machine is started. The verdict SHALL
be available as structured data on request.

#### Scenario: An expectation that holds

- **WHEN** the user tests a program against an expectation whose every action
  succeeds and whose every expectation holds
- **THEN** the test passes

#### Scenario: An expectation that does not hold

- **WHEN** the user tests a program against an expectation that names text the
  program never prints
- **THEN** the test fails, reporting that expectation by its line and the text
  expected, shows the screen as it stood, and exits with the outcome reserved
  for a program at fault

#### Scenario: A verdict read by a program

- **WHEN** a caller asks for the verdict as structured data
- **THEN** standard output holds the verdict, every step and how it went, the
  failing step where there was one, and the screen, and nothing else

### Requirement: Driving a machine requires its ROM

A run given a schedule, and a test, SHALL require the machine's ROM to be
present, and SHALL refuse a machine whose ROM is absent as the caller's mistake
before any action is taken — a verdict from a machine that ran nothing would say
nothing about the program. A run given no schedule SHALL keep reporting a missing
ROM as a condition of the run rather than refusing.

#### Scenario: Testing without the ROM

- **WHEN** the user tests a program, or runs one with a schedule, on a machine
  whose ROM is not present
- **THEN** the operation is refused as the caller's mistake, saying the ROM is
  missing, and no action is carried out
