## ADDED Requirements

### Requirement: The assistant can do what any other caller of this toolchain can do

What the assistant is able to do to a program or a machine SHALL be the same set
any other caller of this toolchain is able to do, held to one account of that
set rather than maintained beside it. The assistant SHALL NOT lack an operation
another caller has, nor hold one no other caller can reach, unless that
asymmetry is declared with its reason.

Where the chosen provider cannot be given tools at all, that SHALL be a stated
property of the provider, on the same terms as being shown a screen and being
given the machine already are. It SHALL NOT be read as the assistant lacking any
particular operation, and every other part of the assistant SHALL behave
identically on such a provider.

#### Scenario: An operation another caller gains

- **WHEN** an operation becomes available elsewhere in the toolchain
- **THEN** the assistant can perform it too, unless it is declared as one the
  assistant deliberately does not have

#### Scenario: A provider that cannot be given tools

- **WHEN** the user selects a provider that cannot be given tools
- **THEN** the assistant has none, that is stated as a property of the provider,
  and the assistant otherwise works exactly as before

### Requirement: What the assistant is offered does not vary within a conversation

The set of operations the assistant is offered SHALL be the same on every turn
of a conversation, and SHALL NOT vary with what happens to be possible at that
moment. An operation whose circumstances are not met SHALL still be offered and
SHALL report that it could not be carried out when it is called.

This is what already holds for driving, where the machine is given on one turn
and not on others, and it SHALL hold for every operation for the same two
reasons: a set that comes and goes costs the conversation the work already done
on it, and an attempt that vanishes reads to the assistant as an attempt that
worked.

#### Scenario: An operation whose circumstances are not met

- **WHEN** the assistant performs an operation on a turn where it cannot be
  carried out
- **THEN** it is told the attempt was refused and why, rather than the attempt
  being passed over as though it had worked

#### Scenario: The same set on every turn

- **WHEN** a conversation runs over several turns whose circumstances differ
- **THEN** the assistant is offered the same operations on each of them

### Requirement: The assistant can check and build a program without running it

The assistant SHALL be able to check a program for problems without running it,
and to ask what that program builds into for the machine it is written for — its
size as the machine's memory counts it, and which of the machine's file formats
it was built as.

It SHALL be able to ask this of a program it is about to offer, so a problem it
could have found itself is found before the user is asked to look at it, rather
than after the program has been applied and run.

A built program's bytes SHALL NOT be shown to the assistant. What it is told is
what it can act on.

#### Scenario: Checking a program before offering it

- **WHEN** the assistant checks a program it is about to return
- **THEN** it is told that program's problems, without the program being run

#### Scenario: Asking what a program builds to

- **WHEN** the assistant asks what its program builds into
- **THEN** it is told the size and the format, and not the bytes

#### Scenario: A program that cannot be built

- **WHEN** the assistant asks what a program with a fatal problem builds into
- **THEN** it is told the problem rather than a size
