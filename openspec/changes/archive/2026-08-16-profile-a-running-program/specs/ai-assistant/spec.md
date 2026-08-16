## ADDED Requirements

### Requirement: The assistant can ask where a program's time and memory went

The measurements taken of a run SHALL be something the assistant can ask for, so
that an answer about a program's speed or memory use is grounded in what the
machine did rather than in what the assistant supposes a machine of that kind
would do.

What it is given SHALL be the measurements of the run as the user's own IDE
holds them — the same accounting shown against the program, including that a
line's cost excludes the routines it calls — so the assistant and the user are
never reading two different accounts of one run.

The assistant SHALL ask for the measurements when it needs them rather than
being given them with every request, so that a conversation that has nothing to
do with performance does not carry them.

Where the machine has not been measured, or has produced no measurements yet,
the assistant SHALL be told so and SHALL NOT be given an empty or invented
result.

#### Scenario: Asked to make a program faster

- **WHEN** the user asks the assistant to speed up a program that has been run
- **THEN** the assistant can ask where that run's time went, and is given the
  same per-line costs the user is shown

#### Scenario: Measurements are not carried by every request

- **WHEN** the user holds a conversation that never concerns the program's
  performance
- **THEN** no request in it carries the run's measurements

#### Scenario: Nothing has been measured yet

- **WHEN** the assistant asks for measurements before the program has been run
- **THEN** it is told there are none, rather than being given an empty result

### Requirement: Being able to read the measurements is a stated capability

Whether the assistant can be given a program's measurements SHALL be a stated
property of the machine, resolved from what that machine can determine, rather
than something discovered by asking and failing.

Where a machine produces no measurements, the IDE SHALL NOT present them as
available to the assistant, and every other part of the assistant SHALL behave
identically on such a machine.

What the assistant is offered SHALL NOT change during a conversation according
to whether a machine happens to be running at that moment, so that what it may
ask for is settled once for the conversation rather than varying turn by turn.

#### Scenario: A machine that produces no measurements

- **WHEN** the user works on a machine whose measurements the IDE cannot produce
- **THEN** the assistant is not offered them, and otherwise works exactly as
  before

#### Scenario: What may be asked for does not change mid-conversation

- **WHEN** a machine starts or stops during a conversation
- **THEN** what the assistant is offered stays as it was for the rest of that
  conversation
