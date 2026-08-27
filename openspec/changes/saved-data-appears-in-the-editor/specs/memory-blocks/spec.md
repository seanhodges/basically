## MODIFIED Requirements

### Requirement: Blocks are part of the document

A document SHALL be its BASIC source plus zero or more named memory blocks
(raw bytes at a fixed address). A block SHALL declare which of three kinds it
is: machine **code** at a fixed address, a block of **memory** at a fixed
address, or a **data** file a program saved to tape or disk. The first two are
the document's blocks and are what this capability governs; a data file has no
address, is not part of the document, and is governed where the files a running
program saves are governed.

Blocks SHALL travel with the document through autosave, save/open, export, and
sharing, and SHALL reset when a different program becomes active.

Where a machine's export format can hold more than the BASIC program, that
export SHALL carry the document's blocks, so a program exported and loaded on
real hardware is the whole program. Where a machine's format has no room for
them, the IDE SHALL say so before exporting rather than dropping them silently.

A document saved before blocks distinguished memory from files SHALL open
unchanged: a block it recorded as data SHALL be read as a block of memory, at
the address and with the bytes it was saved with.

#### Scenario: Blocks survive a reload

- **WHEN** the user closes and reopens the IDE while a document with blocks
  is autosaved
- **THEN** the blocks are restored with the source

#### Scenario: An export that can carry blocks round-trips

- **WHEN** the user exports a document with blocks in a format that can hold
  them, and imports the exported file back
- **THEN** the source and every block return intact

#### Scenario: An export that cannot carry blocks says so

- **WHEN** the user exports a document with blocks in a format that holds only
  the BASIC program
- **THEN** they are told the blocks will not travel, and choose whether to
  export without them

#### Scenario: A block saved under the old kind name reopens as memory

- **WHEN** the user opens a document saved with a block recorded as data
- **THEN** that block is a block of memory, at its original address, with its
  bytes unchanged

### Requirement: Runs are gated on block validity

Before running, the document's blocks — those holding code or memory at an
address — SHALL be checked against the machine's legal ranges, against each
other, and against the tokenized program's footprint; any error-severity
conflict SHALL block the run with an explanation. A data file has no address to
check and SHALL never gate a run.

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

#### Scenario: Saved data files do not gate a run

- **WHEN** the user invokes Run while data files a previous run saved are shown
- **THEN** they are not checked for address conflicts and the run proceeds

### Requirement: Blocks load with the program

When a program runs, the document's blocks — those holding code or memory at an
address — SHALL be present in machine memory at their addresses before the
program starts, so the BASIC can call into them immediately. A data file SHALL
NOT be written into machine memory: it is a file a program saved, not a location.

#### Scenario: BASIC calls machine code

- **WHEN** a program whose first statement calls a routine in a block is run
- **THEN** the routine executes correctly

#### Scenario: A saved data file is not loaded into memory

- **WHEN** a program is run while data files a previous run saved are shown
- **THEN** no part of machine memory is set from them
