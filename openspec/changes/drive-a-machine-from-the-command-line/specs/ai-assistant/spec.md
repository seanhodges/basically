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
SHALL be named in a vocabulary that does not depend on the machine — the same one
any other caller driving a machine writes — so that a sequence of keys written for
one machine means the same thing on another. Each machine SHALL resolve a name to
whatever its own keyboard calls that key, and a name SHALL resolve to the key that
types it rather than to the position its machine's keyboard hardware gives that
name. The assistant SHALL be told which of those names the machine in front of it
has, so it cannot ask for a key that machine does not have, and a name that
machine has no key for SHALL be refused rather than resolved to some other key.
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

#### Scenario: The same keys on a different machine

- **WHEN** the assistant drives programs on two machines whose keyboards name
  their keys differently
- **THEN** it presses the same key by the same name on both, and each machine
  presses its own key for that name

#### Scenario: A key this machine does not have

- **WHEN** the assistant asks for a key the machine in front of it has no
  equivalent of
- **THEN** it is told so, and no other key is pressed in its place

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
