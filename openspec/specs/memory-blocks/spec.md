# memory-blocks Specification

## Purpose

Let a program carry machine code and data alongside its BASIC: named memory
blocks pinned to fixed addresses, editable as assembly where they hold code,
validated before running, and included wherever the program travels.

## Requirements

### Requirement: Blocks are part of the document

A document SHALL be its BASIC source plus zero or more named memory blocks
(raw bytes at a fixed address). Blocks SHALL travel with the document through
autosave, save/open, export, and sharing, and SHALL reset when a different
program becomes active.

Where a machine's export format can hold more than the BASIC program, that
export SHALL carry the document's blocks, so a program exported and loaded on
real hardware is the whole program. Where a machine's format has no room for
them, the IDE SHALL say so before exporting rather than dropping them silently.

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

### Requirement: Code blocks are editable as assembly

A code block SHALL be editable as assembly source for the machine's CPU in
its own editor tab, assembled with errors reported per line (never thrown),
and the block's tab SHALL show when its source currently fails to assemble.

#### Scenario: Assembly error

- **WHEN** the user introduces a syntax error in a block's assembly source
- **THEN** the error is shown at its line and the block's tab is flagged

### Requirement: Disassembly round-trips exactly

Bytes imported into a code block SHALL disassemble to source that assembles
back to byte-identical output. Disassembly SHALL follow the code's control
flow from the block's entry point where possible, rendering unreachable bytes
as data rather than mis-decoding them.

#### Scenario: Import and rebuild

- **WHEN** the user imports machine code and immediately re-assembles the
  disassembled source
- **THEN** the output bytes equal the imported bytes

### Requirement: Runs are gated on block validity

Before running, blocks SHALL be checked against the machine's legal ranges,
against each other, and against the tokenized program's footprint; any
error-severity conflict SHALL block the run with an explanation.

#### Scenario: Overlapping blocks

- **WHEN** two blocks claim overlapping addresses and the user invokes Run
- **THEN** the run is refused and the overlap is reported

### Requirement: Blocks load with the program

When a program runs, its blocks SHALL be present in machine memory at their
addresses before the program starts, so the BASIC can call into them
immediately.

#### Scenario: BASIC calls machine code

- **WHEN** a program whose first statement calls a routine in a block is run
- **THEN** the routine executes correctly
