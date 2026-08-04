## ADDED Requirements

### Requirement: The assistant can drive the program it wrote

Alongside the code it returns, the assistant MAY ask to be given the machine once
that program has been run and observed. Where it asks, and where the chosen
provider can be given it, the IDE SHALL let the assistant act on the running
machine and see what happened, repeatedly, before it reports on its own program.

What it can do SHALL be what a person at that machine could do: type text, press
the machine's own keys, work the joystick, wait, and look at the screen. Keys
SHALL be named as that machine names them, and the assistant SHALL be told which
names that machine has, so it cannot ask for a key the machine does not have.
Joystick directions and fire SHALL reach the program the way the machine's own
controller does, whether that machine has a joystick port or maps it to keys.

Waiting SHALL be expressible as waiting for text to appear on screen, not only as
waiting a fixed length of machine time, so that driving does not depend on
guessing how long a machine takes.

Between the assistant's actions the machine SHALL be held still, so that what it
acts on is the screen it was last shown rather than one that ran on while it was
deciding.

Driving SHALL be bounded — in how many times the assistant may act and in how
much machine time it may spend — and reaching that bound SHALL end the driving
and let the assistant report, rather than failing the answer.

Asking to drive SHALL be optional. A reply that does not ask behaves exactly as a
reply does today, and no machine becomes unusable for not being driven.

#### Scenario: A program that waits for input

- **WHEN** the assistant returns a program that asks the user a question, asks to
  drive it, and that program is run
- **THEN** it can type an answer and press the machine's enter key, and what it
  is shown afterwards is the screen the program reached, not the question

#### Scenario: A program behind a title screen

- **WHEN** the assistant returns a program that waits for a keypress before it
  starts, and asks to drive it
- **THEN** it can wait for that prompt to appear, press a key, and see the
  program running rather than its title screen

#### Scenario: A program driven with the joystick

- **WHEN** the assistant drives a program with the joystick on a machine with no
  joystick port
- **THEN** the input reaches the program as that machine's mapped keys, exactly
  as the on-screen controller would deliver it

#### Scenario: A reply that does not ask to drive

- **WHEN** the assistant returns a program and asks for no driving
- **THEN** the machine is not driven, and the answer is checked exactly as it is
  today

#### Scenario: Driving runs out of its bound

- **WHEN** the assistant keeps acting until the bound on driving is reached
- **THEN** driving ends, the assistant is told so, and it reports on its program
  rather than the answer failing

### Requirement: The assistant can be shown the screen as text

The characters on the machine's screen SHALL be something the assistant can be
shown, as well as the screen as a picture. It SHALL be the screen as it stood at
the moment the run was observed — the same moment the picture is taken — rather
than a separate reading of a machine that has moved on.

The assistant SHALL be told that text is the answer for a program whose output is
words and the picture for what only a picture can settle, so that it asks for the
cheaper and exact one where that is enough.

Unlike the picture, being shown the screen as text SHALL NOT depend on the chosen
provider, because it is text like every other part of a request.

Where the characters cannot be determined, that view SHALL be reported as
unavailable, on the same terms as any other view that cannot be produced.

#### Scenario: A program whose output is text

- **WHEN** the assistant returns a program that prints its result and asks to be
  shown the screen as text
- **THEN** the outcome of that run carries the characters on screen

#### Scenario: The text and the picture describe the same moment

- **WHEN** the assistant is shown both the screen as text and the screen as a
  picture for one run
- **THEN** both are of the machine as it stood when that run was observed

#### Scenario: A provider that cannot be shown a picture

- **WHEN** the assistant writes for a provider that cannot be shown images and
  asks to be shown the screen as text
- **THEN** it is shown the text, and only the picture is reported as unavailable

### Requirement: Being able to drive the machine is a stated capability

Whether the assistant can be given the machine SHALL be a stated property of the
chosen provider rather than something discovered by attempting it. Where a
provider cannot be given it, the IDE SHALL NOT present driving as available and
SHALL NOT ask the assistant to drive; every other part of the assistant SHALL
behave identically on such a provider.

#### Scenario: Switching to a provider that cannot be given the machine

- **WHEN** the user selects a provider that cannot be given the machine
- **THEN** driving is not offered, no request asks for it, and the assistant
  otherwise works exactly as before

### Requirement: Driving that fails is not the program failing

Where the driving itself does not work out — waiting for text that never appears,
naming a key the machine does not have, or a machine that never came up to be
driven — the IDE SHALL report that to the assistant as what it is, and SHALL NOT
treat it as the program being wrong.

Such a failure SHALL NOT fail the run and SHALL NOT prompt an unrequested
correction. Where driving was meant to reach the state an expectation describes
and did not, that expectation SHALL be reported as unchecked rather than as
failed — the same terms as an expectation nothing could evaluate.

#### Scenario: Waiting for text that never appears

- **WHEN** the assistant waits for text that the program never displays
- **THEN** it is told the wait ran out, and the run is not reported as failed
  because of it

#### Scenario: A key the machine does not have

- **WHEN** the assistant asks to press a key this machine's keyboard does not
  have
- **THEN** it is told so and can act again, and the program is not reported as
  wrong

#### Scenario: An expectation the driving never reached

- **WHEN** driving fails before the program reaches the state a stated
  expectation describes
- **THEN** that expectation is reported as unchecked, and no correction is
  attempted

### Requirement: Input the assistant sent is stated

Where the assistant drove the machine and that driving actually sent input, the
conversation SHALL say what was sent, so that a screen the user could not
otherwise account for is explained by what produced it.

Where the assistant only waited or only looked, nothing SHALL be stated: nothing
happened that the user could not have seen for themselves.

What is stated SHALL be what was done to the machine, not the assistant's asking
or the IDE's mechanics — those remain out of the conversation, as every other
part of the checking machinery already is.

#### Scenario: An answer whose screen was reached by typing

- **WHEN** the assistant drove a program by typing an answer into it and the
  finished work is shown
- **THEN** the conversation states that input was sent and what it was

#### Scenario: An answer the assistant only watched

- **WHEN** the assistant asked to drive, then only waited and looked without
  sending any input
- **THEN** nothing is stated about driving, and the answer reads as it would have
  without it
