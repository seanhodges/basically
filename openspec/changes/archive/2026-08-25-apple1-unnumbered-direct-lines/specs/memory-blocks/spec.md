## MODIFIED Requirements

### Requirement: Runs are gated on block validity

Before running, blocks SHALL be checked against the machine's legal ranges,
against each other, and against the tokenized program's footprint; any
error-severity conflict SHALL block the run with an explanation.

Where a machine lets a program move the memory its BASIC workspace occupies, the
footprint judged against SHALL be the one the open program asks for, not the
machine's default - so that a block the program's own workspace would overwrite
is refused rather than silently written over.

#### Scenario: Overlapping blocks

- **WHEN** two blocks claim overlapping addresses and the user invokes Run
- **THEN** the run is refused and the overlap is reported

#### Scenario: A block the program's own workspace would cover

- **WHEN** a program moves its workspace over the memory one of its blocks sits
  in, and the user invokes Run
- **THEN** the run is refused and the collision is reported

#### Scenario: A machine whose workspace is fixed

- **WHEN** blocks are checked on a machine whose BASIC workspace a program
  cannot move
- **THEN** they are judged against the same footprint as before
