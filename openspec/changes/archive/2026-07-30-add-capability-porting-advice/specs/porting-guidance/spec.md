## ADDED Requirements

### Requirement: Every capability a port loses carries advice

For each capability from which a port loses commands, the comparison SHALL say
what to do instead on the machine being ported **to**, and — where that machine's
support for the capability is absent or partial — SHALL show a short worked
example of how that job is done there. This advice SHALL exist for every
capability that any source dialect can lose when porting to any target dialect,
so no comparison reports a lost capability with nothing to say about it.

Advice SHALL be written once per capability per target machine and shown against
the capability group rather than repeated against each command, so that what a
reader must read grows with the number of capabilities affected, not with the
number of commands lost.

#### Scenario: A capability the target lacks entirely

- **WHEN** the comparison reports commands lost from a capability the target
  machine provides no equivalent of
- **THEN** it states what to do instead, and shows a worked example of how that
  job is done on the target machine

#### Scenario: A capability the target supports differently

- **WHEN** the comparison reports commands lost from a capability the target
  machine supports only partially
- **THEN** it states what to do instead and shows a worked example

#### Scenario: Advice exists for every pair

- **WHEN** the user selects any source dialect and any different target dialect
- **THEN** every group of commands to replace carries advice for the target

#### Scenario: Advice is not repeated per command

- **WHEN** a capability group contains many lost commands
- **THEN** the advice for that capability is stated once for the group, not once
  per command

### Requirement: Groups are ordered by how well the target replaces them

The comparison SHALL report capability groups in order of how badly the target
machine is placed to replace them: capabilities it provides no equivalent of
first, then those it supports only partially, then those it provides under other
names.

#### Scenario: A port losing several capabilities

- **WHEN** a port loses commands from a capability the target lacks entirely and
  from one the target supports partially
- **THEN** the capability the target lacks entirely is reported first

## MODIFIED Requirements

### Requirement: Comparing two BASIC dialects

The user SHALL be able to choose a dialect to port **from** and a dialect to
port **to**, and be told what moving a program between them involves: which
commands the target lacks, what the target adds summarised by capability with a
route into the target's own reference, which behave differently, and how the two
machines differ in language rules and hardware. A chosen comparison SHALL be
shareable as a link that reopens the same pair.

#### Scenario: Choosing a pair

- **WHEN** the user chooses a source dialect and a different target dialect
- **THEN** the differences between those two dialects are reported

#### Scenario: The same dialect on both sides

- **WHEN** the user chooses the same dialect as both source and target
- **THEN** no differences are reported, and the user is asked to pick two
  different dialects

#### Scenario: What the target adds

- **WHEN** the target provides many commands the source does not
- **THEN** those additions are summarised by capability — each with how many
  commands it gains and what the machine offers there — rather than listed
  command by command, and the user is offered a route to the target's full
  reference

### Requirement: Guidance is brief

The guidance SHALL be readable in a few minutes for any dialect pair, and SHALL
NOT restate what the difference tables already show. What the reader must read
SHALL grow with the number of capability areas a port affects, not with the
number of commands it involves.

#### Scenario: Guidance for a distant pair

- **WHEN** the user selects two dialects with a large number of differences
- **THEN** the guidance stays brief rather than growing with the size of the
  difference lists

#### Scenario: Guidance scales with capabilities, not commands

- **WHEN** the user selects a pair whose difference lists run to over a hundred
  commands
- **THEN** the guidance shown grows only with the number of capability areas
  affected, and remains readable in a few minutes
