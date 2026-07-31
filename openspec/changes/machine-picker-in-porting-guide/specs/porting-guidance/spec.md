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
