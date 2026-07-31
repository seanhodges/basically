## MODIFIED Requirements

### Requirement: Comparing two BASIC dialects

The user SHALL be able to choose a machine to port **from** and a machine to
port **to**, and be told what moving a program between them involves: which
commands the target lacks, which the target adds, which behave differently, and
how the two machines differ in language rules and hardware. Every machine the
IDE supports SHALL be offered on both sides, including machines that share a
BASIC with a close relative. A chosen comparison SHALL be shareable as a link
that reopens the same pair.

#### Scenario: Choosing a pair

- **WHEN** the user chooses a source machine and a different target machine
- **THEN** the differences between those two machines are reported

#### Scenario: The same machine on both sides

- **WHEN** the user chooses the same machine as both source and target
- **THEN** no differences are reported, and the user is asked to pick two
  different machines

#### Scenario: Two machines that share a BASIC

- **WHEN** the user chooses two machines from the same family, differing only in
  their BASIC version
- **THEN** both are selectable in their own right, and the comparison reports
  what that BASIC version changes rather than reporting no difference

## ADDED Requirements

### Requirement: A command is reported only for machines that have it

Machines that share a BASIC do not always share every command: a later BASIC
version in the same family may add commands its relatives lack. A command
present on only some machines of a family SHALL NOT be reported as a command the
program may use, nor as gained or lost, for a machine that does not have it.
A command SHALL be reported as gained when the target has it and the source does
not, whether or not a relative of the source has it.

#### Scenario: A command only a relative of the source has

- **WHEN** the source machine's family includes a command that the source itself
  does not have
- **THEN** that command is not reported among the commands the port must deal
  with

#### Scenario: A command only a relative of the target has

- **WHEN** the target machine's family includes a command that the target itself
  does not have
- **THEN** that command is not reported as something the target adds

#### Scenario: A command a later BASIC version genuinely adds

- **WHEN** the target has a command the source lacks, because the target runs a
  later BASIC version in the same family
- **THEN** that command is reported as one the target adds

### Requirement: Hardware figures describe the machine chosen

Machines that share a BASIC can differ widely in hardware — free memory in
particular can differ by an order of magnitude between relatives. Every hardware
and language-rule figure the comparison reports SHALL describe the machine the
user selected, not a representative relative.

#### Scenario: A machine whose relatives differ in memory

- **WHEN** the user selects a machine whose family includes relatives with
  different amounts of free program memory
- **THEN** the free-memory figure reported is that machine's own

#### Scenario: Screen and sound differences within a family

- **WHEN** the user selects a machine whose display or sound hardware differs
  from its relatives'
- **THEN** the screen and sound described are that machine's own

### Requirement: A selection covering several machines says so

For a reader who has not yet chosen between close relatives, a BASIC shared by a
family MAY be offered as a selection in its own right. Such a selection SHALL be
labelled so the reader can tell it covers more than one machine, and SHALL NOT
be presented as though it were a single machine. Where a figure differs across
the machines it covers, the selection SHALL report the range rather than any one
machine's value.

#### Scenario: Choosing a whole family

- **WHEN** the user selects a BASIC shared by several machines rather than one
  machine
- **THEN** the selection is labelled as covering several machines

#### Scenario: A figure that differs across the family

- **WHEN** a selection covers machines whose free memory differs
- **THEN** the free memory is reported as a range across those machines, not as
  a single machine's figure

#### Scenario: A figure common to the whole family

- **WHEN** a selection covers machines that agree on a figure
- **THEN** that figure is reported plainly, without a range

### Requirement: Carrying out the port targets the machine chosen

Where the comparison offers to carry the port out, it SHALL convert the program
for the machine the user selected as the target. Where the user selected a BASIC
covering several machines rather than one machine, the offer SHALL make clear
which machine the program will be converted for.

#### Scenario: Converting to a specific machine

- **WHEN** the user selects a machine as the target and asks for the port to be
  carried out
- **THEN** the program is converted for that machine, and the IDE continues on
  that machine

#### Scenario: Converting when the target covers several machines

- **WHEN** the user asks for the port to be carried out having selected a BASIC
  that covers several machines
- **THEN** the machine the program is converted for is named
