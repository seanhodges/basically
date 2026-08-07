## ADDED Requirements

### Requirement: Where the program's writes land on the target is reported

A program that writes directly to memory carries addresses chosen for one machine.
On another machine those addresses reach whatever that machine keeps there, and the
program's text does not change at all — so no list of commands, control codes or
language rules can report it.

Where the reader's own program is at hand and both machines' memory layouts are
described, the comparison SHALL report what each address the program writes to
reaches on the target machine, and what that means for the write. It SHALL
distinguish an address that reaches the same kind of thing at a different place,
one that reaches something else, one that reaches read-only memory and so has no
effect at all, and one the target's address space does not contain.

An address that reaches something else SHALL be reported with both what the
program aimed at and what it would reach, since either alone leaves the reader to
guess the other.

An address the comparison could only approximate SHALL carry that doubt into its
verdict, reported as an estimate rather than as a conclusion.

Where either machine has no described memory layout, or there is no program, no
verdicts SHALL be reported.

#### Scenario: A write that reaches something else on the target

- **WHEN** the open program writes to an address that holds one kind of thing on
  the source machine and a different kind on the target
- **THEN** the comparison reports the write, naming what it aimed at and what it
  would reach on the target

#### Scenario: A write into read-only memory

- **WHEN** the open program writes to an address that is read-only memory on the
  target machine
- **THEN** the comparison reports that the write has no effect there, distinctly
  from a write that reaches something else

#### Scenario: A write the target's memory does not contain

- **WHEN** the open program writes to an address beyond the target machine's
  address space
- **THEN** the comparison reports that the target has no such address

#### Scenario: A write that reaches the same kind of thing

- **WHEN** the open program writes to an address that holds the same kind of thing
  on both machines, at different addresses
- **THEN** the comparison reports it as an address to change rather than reporting
  nothing

#### Scenario: An address that could only be approximated

- **WHEN** the comparison could not resolve a write address exactly
- **THEN** its verdict is reported as an estimate

#### Scenario: A machine with no described layout

- **WHEN** either machine's memory layout is not described
- **THEN** no verdicts are reported, as no layouts are

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** no verdicts are reported
