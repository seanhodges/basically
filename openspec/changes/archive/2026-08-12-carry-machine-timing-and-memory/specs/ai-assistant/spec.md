## MODIFIED Requirements

### Requirement: The assistant knows the machine and the program

Each request SHALL carry the active dialect's language rules and the current
program (with its outstanding lint errors), so generated code targets the
machine the user is writing for.

The language rules carried SHALL be the machine's own, complete definition: every
command, function and operator the machine accepts, with its usage and its
behaviour; the machine's line-numbering, statement, assignment, variable-naming
and number-handling rules; the printable characters its character set cannot represent,
where it cannot represent them all; how it spells the control codes its character set
holds; its screen, colour and sound capabilities; and, where
the machine lacks a capability another machine has, what to do on this machine
instead.

The screen SHALL additionally be carried as the columns and rows of the screen
the machine boots into, in a form a print position can be checked against
rather than only read: the prose summary describes the modes a machine can
reach, which does not say where a program may print before it selects one.

The request SHALL carry how long a wait takes on this machine — the machine's
own idiom for waiting, and the rate at which it runs a loop that only counts.
A pause written as a counting loop is the machine's speed written into the
program, and the machines differ in that speed by more than an order of
magnitude. The rate SHALL be quoted as measured in this product's own
emulators, never as a fact about the original hardware, and a machine with no
measured rate SHALL carry none rather than an estimate.

Where the machine has a described memory layout, the request SHALL carry it:
the range of addresses that exist, each named region with its bounds and what
it holds, and memory that cannot be written marked as such. A program that
addresses memory directly is asking for something particular — the keyboard, a
clock, the sound hardware — and an address reached for from recollection does
not fail, it returns or writes a number that means nothing. Where a machine
has no described layout, none SHALL be carried, rather than part of one: an
address missing from a partial layout reads as an address the machine does not
have.

Addresses SHALL be written as the machine itself writes them, and the same way
wherever the assistant meets them, so that an address in the machine's
description and the same address in a port's findings are recognisably one
address.

A machine that represents printable ASCII in full SHALL carry no statement about
characters it lacks, rather than a statement that it lacks none.

These SHALL come from the same source as the guidance the IDE shows the user, so
that what the assistant is told and what the user is shown about a machine cannot
disagree.

Every machine SHALL be described to the same standard, so that the completeness
of what the assistant knows does not vary by machine.

#### Scenario: Dialect-correct generation

- **WHEN** the user asks for a program on a machine with restrictive syntax
  rules
- **THEN** the generated code follows that machine's rules rather than
  generic BASIC

#### Scenario: A command outside the machine's common repertoire

- **WHEN** the user asks for something needing a command the machine has but
  which is rarely used
- **THEN** the assistant can use it, because the machine's full command set was
  carried with the request

#### Scenario: A capability the machine does not have

- **WHEN** the user asks for something the machine has no command for
- **THEN** the assistant applies the approach documented for that machine rather
  than inventing a command or using another machine's

#### Scenario: A character the machine cannot represent

- **WHEN** the user asks for text containing a character the machine's character set
  has no glyph for
- **THEN** the assistant writes text the machine can represent, rather than producing
  a program that fails to be read and correcting it afterwards

#### Scenario: Writing a control code

- **WHEN** the user asks for something needing an embedded control code
- **THEN** the assistant spells it as this machine spells it, because the machine's
  control-code spellings were carried with the request

#### Scenario: A layout written for the machine's own screen

- **WHEN** the user asks for something that prints at chosen positions
- **THEN** the positions lie within the screen the machine boots into, because
  its columns and rows were carried with the request

#### Scenario: A pause of a stated length

- **WHEN** the user asks for a program that waits
- **THEN** the wait is written with the machine's own idiom, or where it has
  none, counted against the rate that machine was measured to run at

#### Scenario: A machine that cannot be benchmarked

- **WHEN** the request carries a machine for which no loop rate was measured
- **THEN** it states no rate, rather than an estimated one

#### Scenario: Addressing memory directly

- **WHEN** the user asks for something reached by reading or writing memory
- **THEN** the address used is one the machine's own layout names for that
  purpose, because the layout was carried with the request

#### Scenario: A machine with no described layout

- **WHEN** the request carries a machine whose layout is not described
- **THEN** it carries no memory layout at all, rather than the part that is
  known

#### Scenario: The assistant and the guidance agree

- **WHEN** the assistant states a language rule for a machine and the IDE's own
  guidance states the same rule
- **THEN** the two agree, because both are drawn from one source
