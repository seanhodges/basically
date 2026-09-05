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

### Requirement: Blocks are editable as bytes

A block that is not editable as assembly — a memory block, or a code block for
a CPU the IDE has no assembler for — SHALL be editable as bytes in its own tab,
showing each byte's address, its value in hexadecimal, and the character the
machine's own character set gives it.

The hexadecimal and character views SHALL be two views of the same bytes, lined
up row by row against the addresses those bytes occupy. Both SHALL be shown
together where there is room for them and offered as alternatives where there is
not. A change made through either view SHALL be reflected in the other as soon
as it is made, and undoing it SHALL undo it in both.

Byte editing SHALL be overwrite-only within a block: entering a new value for a
byte SHALL NOT move any other byte, and bytes SHALL NOT be inserted into or
removed from the middle of a block. A block's length SHALL be changeable in the
editor itself — bytes entered past its last byte extend it, and bytes removed
from its end shorten it — and growing a block SHALL pad it with zero. A length
change SHALL be undoable like any other edit, as a code block's assembly edits
are, rather than confirmed before it is made.

Where the machine cannot hold a byte the user has entered, the block SHALL be
left unchanged and the refusal SHALL be visible. A character SHALL be encoded
through the machine's own character set, and a character that machine cannot
represent SHALL be refused rather than stored as something else. On a machine
that carries a block inside the BASIC listing, a byte value that listing cannot
hold SHALL be refused the same way.

The user SHALL be able to fill a range of bytes with a chosen value, and to
replace a block's contents from a file.

Byte edits SHALL be undoable within the block being edited, and that history
SHALL survive showing a different tab and coming back — as a code block's
assembly history does. Editing one block's bytes SHALL NOT disturb the editing
history of another block. Where a block is carried inside the BASIC listing,
editing its bytes rewrites that listing, and the BASIC program's own editing
history SHALL be discarded rather than left describing text that no longer
exists.

Editing bytes SHALL be possible on a touch screen as well as with a keyboard,
using the same on-screen keyboard the program's own editor uses.

#### Scenario: A memory block can be edited

- **WHEN** the user opens the tab of a block that holds memory rather than code
- **THEN** they can see its bytes with their addresses and change them

#### Scenario: The two views stay in step

- **WHEN** the user changes a byte through one of the two views
- **THEN** the other view shows the new value for that byte immediately

#### Scenario: Editing a byte leaves its neighbours where they are

- **WHEN** the user enters a new value over a byte in the middle of a block
- **THEN** that byte changes and every other byte keeps its address

#### Scenario: A block grows when bytes are entered past its end

- **WHEN** the user enters a byte value past the block's last byte
- **THEN** the block is longer by that byte and every byte it already held
  keeps its address

#### Scenario: Shortening a block can be undone

- **WHEN** the user shortens a block and then undoes
- **THEN** the bytes that were discarded come back with the values they had

#### Scenario: A character the machine cannot represent is refused

- **WHEN** the user types a character with no code in the machine's character
  set into the character view
- **THEN** the block is unchanged and the refusal is visible

#### Scenario: A byte the machine's listing cannot hold is refused

- **WHEN** the user enters a byte value that cannot be carried in the BASIC
  listing, in a block that machine keeps inside its listing
- **THEN** the block is unchanged and the refusal is visible

#### Scenario: A block's byte history outlives showing another tab

- **WHEN** the user edits a block's bytes, shows another tab, comes back and
  undoes
- **THEN** that block's own last byte edit is undone

#### Scenario: Bytes can be loaded from a file

- **WHEN** the user loads a file of bytes into a block
- **THEN** the block holds those bytes, at its own address
