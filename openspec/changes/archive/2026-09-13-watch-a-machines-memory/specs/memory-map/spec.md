## ADDED Requirements

### Requirement: A memory map can show what the running machine is touching

Where the memory map is shown of a machine that is running, and that machine can
report which addresses its processor touches, the map SHALL show those addresses
over the regions they fall in, as the program runs.

A read SHALL be told apart from a write, by the same distinction wherever a map
is shown, so that a user learns one way of reading it and it holds everywhere.

Recent activity SHALL be distinguishable from older activity, so that what the
program is doing now is readable from what it did a moment ago rather than
accumulating into an undifferentiated wash.

Activity SHALL be recorded only while a map of the machine is being shown. A
machine whose map nobody is looking at SHALL record nothing, and showing a map
SHALL NOT change what the program does or how long it takes in the machine's own
time.

#### Scenario: Watching a program work

- **WHEN** the user shows the memory map of a running machine that can report
  what its processor touches
- **THEN** the addresses being read and the addresses being written are shown
  over the regions containing them, told apart from one another

#### Scenario: What the program is doing now

- **WHEN** a program stops touching a region it was touching a moment ago
- **THEN** that region's activity fades rather than persisting as though it were
  still being touched

#### Scenario: A map nobody is looking at

- **WHEN** a program runs on a machine whose memory map is not being shown
- **THEN** nothing about what its processor touches is recorded, and the program
  runs exactly as it would have

### Requirement: A machine that cannot report what it touches says so

Where a machine has a described memory layout but cannot report which addresses
its processor touches, the map SHALL state that this machine cannot report it.

The map SHALL NOT present an unmarked layout as the result of a program that
touched nothing: a machine that cannot say and a program that did nothing are
different facts, and a user SHALL be able to tell which they are looking at.

#### Scenario: A machine with no accesses to report

- **WHEN** the user shows the memory map of a machine that has a described
  layout but cannot report what its processor touches
- **THEN** the layout is shown and the map states that this machine cannot
  report what it is touching

#### Scenario: A program that touched nothing

- **WHEN** the user shows the memory map of a machine that can report what its
  processor touches, and no program has run
- **THEN** the map shows no activity, and says nothing about the machine being
  unable to report it
