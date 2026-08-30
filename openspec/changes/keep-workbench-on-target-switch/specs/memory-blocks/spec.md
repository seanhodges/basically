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

A program the user keeps across a switch of target machine SHALL keep its
blocks, where the new machine supports blocks at all and holds them the same way
the old one did. They SHALL keep their names, addresses, bytes and assembly
source: a block is not re-sited, re-assembled, or translated for the new
machine, so one that no longer fits SHALL be reported by the block validity
check rather than altered or dropped in silence. Where the new machine supports
no blocks, or holds them inside the BASIC listing rather than at fixed addresses
(or the reverse), the blocks SHALL be dropped and the user SHALL be told so
before the switch is applied. Starting a new program on the new machine SHALL
start it with no blocks.

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

#### Scenario: Keeping the program on a new machine keeps its blocks

- **WHEN** the user switches to a machine that supports blocks the same way,
  and chooses to keep their code
- **THEN** every block is still in the document, at the address, with the bytes
  and with the assembly source it had

#### Scenario: A kept block that does not fit the new machine is reported

- **WHEN** a block kept across a switch sits at an address the new machine's
  memory map does not allow
- **THEN** the block validity check reports it, and the program is not run until
  the user resolves it

#### Scenario: Starting new on a new machine starts with no blocks

- **WHEN** the user switches target machine and chooses to start a new program
- **THEN** the new program has no blocks

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
