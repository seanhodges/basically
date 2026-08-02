## MODIFIED Requirements

### Requirement: The assistant knows the machine and the program

Each request SHALL carry the active dialect's language rules and the current
program (with its outstanding lint errors), so generated code targets the
machine the user is writing for.

The language rules carried SHALL be the machine's own, complete definition: every
command, function and operator the machine accepts, with its usage and its
behaviour; the machine's line-numbering, statement, assignment, variable-naming
and number-handling rules; its screen, colour and sound capabilities; and, where
the machine lacks a capability another machine has, what to do on this machine
instead.

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

#### Scenario: The assistant and the guidance agree

- **WHEN** the assistant states a language rule for a machine and the IDE's own
  guidance states the same rule
- **THEN** the two agree, because both are drawn from one source
