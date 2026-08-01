## ADDED Requirements

### Requirement: Choosing a machine distinguishes it from its relatives

Machines that share a BASIC often have names that prefix or echo one another,
and those are exactly the pairs whose comparisons differ most — in free memory,
in the commands available, and in which machine a port is carried out for. The
choice of machine SHALL therefore identify each one by more than its name, so
that a reader can tell two machines of the same family apart while choosing,
rather than only on reading the comparison that follows.

The machine currently chosen SHALL remain identifiable without reopening the
list.

#### Scenario: Telling two machines of a family apart

- **WHEN** the user is choosing between two machines whose names prefix or echo
  one another
- **THEN** each is identified by more than its name, so which is which is
  apparent before the comparison is drawn

#### Scenario: Seeing what is currently chosen

- **WHEN** the user has chosen a machine and is not looking at the list of
  machines
- **THEN** the machine chosen is still identified

#### Scenario: Choosing without a pointer

- **WHEN** the user operates the choice of machine by keyboard alone
- **THEN** each machine can be reached and chosen, and each is named
  unambiguously

#### Scenario: Which choice is being made

- **WHEN** the user is presented with the choice of machine to port from and the
  choice of machine to port to
- **THEN** each states which of the two it is

## MODIFIED Requirements

<!-- The three requirements below change wording only. `compare-machines-not-pages`
     made the machine the unit of selection but modified just the one requirement
     that names it; these still describe the user as selecting a dialect, which is
     no longer a thing the comparison offers. No guarantee changes. -->

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each machine has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target machine that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

### Requirement: Guidance is brief

The guidance SHALL be readable in a few minutes for any machine pair, and SHALL
NOT restate what the difference tables already show.

#### Scenario: Guidance for a distant pair

- **WHEN** the user selects two machines with a large number of differences
- **THEN** the guidance stays brief rather than growing with the size of the
  difference lists

### Requirement: Guidance covers both the general and the machine-specific

The guidance SHALL describe what any port between these BASICs involves, independently of the pair
chosen, and SHALL additionally describe what is specific to the machine being ported **to**. Every
machine offered as a target SHALL carry its own guidance, so no valid pair produces a comparison
without it.

What any port involves does not change with the pair, so it SHALL be given a page of its own rather
than sit within the comparison, and the comparison SHALL point to it before the reader reaches the
pair-specific sections, naming it as the thing to read first by a reader new to porting.

#### Scenario: Guidance for any target

- **WHEN** the user selects any machine as the porting target
- **THEN** the guidance specific to that target is shown, and what any port involves is one link
  away, offered before the pair-specific sections

#### Scenario: Reading what any port involves

- **WHEN** the user follows that link
- **THEN** what any port between these BASICs involves is given in full

## RENAMED Requirements

- FROM: `### Requirement: Comparing two BASIC dialects`
- TO: `### Requirement: Comparing two machines`
