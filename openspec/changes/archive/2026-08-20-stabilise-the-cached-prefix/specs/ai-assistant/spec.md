## MODIFIED Requirements

### Requirement: The assistant can drive the program it wrote

Alongside the code it returns, the assistant MAY ask to be given the machine once
that program has been run and observed. Where it asks, and where the chosen
provider can be given it, the IDE SHALL let the assistant act on the running
machine and see what happened, repeatedly, before it reports on its own program.

What the assistant is told about whether the machine can be driven SHALL describe
what the chosen provider can actually do, and SHALL be the same for every request
in a conversation. A conversation SHALL NOT tell the assistant on one turn that
the machine cannot be driven and on another that it can.

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

An attempt to act on the machine outside the window in which the machine is given
SHALL be refused and the refusal reported to the assistant, rather than passed
over in silence. An attempt that vanishes reads as an attempt that worked.

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

#### Scenario: The same answer on every turn of a conversation

- **WHEN** the user asks a question, and the IDE later raises a request of its own
  in the same conversation to check the answer
- **THEN** both requests tell the assistant the same thing about whether the
  machine can be driven

#### Scenario: A provider that cannot be given the machine, asked on any turn

- **WHEN** the chosen provider cannot be given the machine
- **THEN** every request in the conversation says so, and none of them invites the
  assistant to ask for something it cannot have

#### Scenario: Acting on the machine when it has not been given

- **WHEN** the assistant tries to act on the machine on a turn where the machine
  has not been given to it
- **THEN** it is told the attempt was refused, rather than the attempt being
  passed over as though it had worked
