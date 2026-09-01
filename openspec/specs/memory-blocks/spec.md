# memory-blocks Specification

## Purpose

Let a program carry machine code and data alongside its BASIC: named memory
blocks pinned to fixed addresses, editable as assembly where they hold code,
validated before running, and included wherever the program travels.
## Requirements
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

### Requirement: Code blocks are editable as assembly

A code block SHALL be editable as assembly source for the machine's CPU in
its own editor tab, assembled with errors reported per line (never thrown),
and the block's tab SHALL show when its source currently fails to assemble.

The block's editor SHALL offer the same general editing the BASIC editor does —
undo, redo, cut, copy, paste and find/replace — and SHALL carry its own edit
history, which survives showing a different tab and coming back.

Where a block's bytes change from outside its editor, the editor SHALL be
re-seeded from the new bytes and that re-seeding SHALL NOT be undoable, since
undoing it would leave source that no longer describes the block.

#### Scenario: Assembly error

- **WHEN** the user introduces a syntax error in a block's assembly source
- **THEN** the error is shown at its line and the block's tab is flagged

#### Scenario: A block's history outlives showing another tab

- **WHEN** the user edits a block's assembly, shows another tab, comes back and
  undoes
- **THEN** that block's own last edit is undone

#### Scenario: Editing one block leaves another alone

- **WHEN** the user edits one block, shows a second block and undoes
- **THEN** the second block is unchanged and the first keeps its edit

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

### Requirement: A block may sit in conditionally free memory

Some machines hold memory that hardware claims only when the program exercises
an optional feature — video RAM above the text screen that only the graphics
modes reach, a band under a bitmap screen the machine's boot mode never
touches. On the real machine, programs that leave the feature alone use that
memory freely; a checker that always assumes the feature in use refuses
placements the machine accepts.

Where a machine declares such a region, with the condition under which the
program leaves it untouched, a block placed there SHALL be accepted when the
open program's own text meets the condition — the screen modes it selects with
constant arguments, and the addresses it writes. The acceptance SHALL carry a
warning naming the condition the placement leans on, so a program that later
comes to use the feature has a visible thread back to the block that must
move.

Where the condition is not met, or a mode is selected with a value the text
does not fix, or the program writes into the region, or there is no program to
read, the placement SHALL be refused as it is today, and the refusal SHALL
name the condition that would make it legal. Doubt SHALL run toward refusal:
memory that cannot be proven free is not free.

Machines that declare no such region SHALL behave exactly as before.

#### Scenario: A block in video RAM the program never draws to

- **WHEN** a machine declares its graphics memory conditionally free, the open
  program stays in the text mode, and the user places a block in that region
- **THEN** the run is allowed, with a warning naming the condition the
  placement depends on

#### Scenario: The program selects a graphics mode

- **WHEN** a block sits in a conditionally free region and the open program
  selects a screen mode that claims that region
- **THEN** the run is refused, and the refusal names the condition under which
  the region would be free

#### Scenario: A mode the text does not fix

- **WHEN** a block sits in a conditionally free region and the open program
  selects a screen mode whose value is computed rather than written as a
  constant
- **THEN** the run is refused, as it is when the condition is unmet

#### Scenario: A write into the region

- **WHEN** a block sits in a conditionally free region and the open program
  writes to an address inside that region
- **THEN** the run is refused, whatever modes the program selects

#### Scenario: A machine without conditional regions

- **WHEN** a block is placed on a machine that declares no conditionally free
  region
- **THEN** every placement lints exactly as it did before

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
change made that way SHALL be undoable like any other edit, as a code block's
assembly edits are, rather than confirmed before it is made.

A block's size SHALL in addition be settable outright, in the block's own
settings, beside the address that bounds it — a change of scale that would be
absurd to type a byte at a time. A size set there SHALL take effect when those
settings are saved, as a move does, and SHALL be bounded by what the machine
can hold at the block's address. Growing SHALL pad with zero and shrinking
SHALL discard from the end, exactly as editing the block's last byte does. A
block whose bytes are produced by assembling its source SHALL NOT have its size
set this way: the assembler decides how long such a block is, and its settings
SHALL state that size rather than offer to overrule it.

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

#### Scenario: Shortening a block in the editor can be undone

- **WHEN** the user shortens a block by removing bytes from its end and then
  undoes
- **THEN** the bytes that were discarded come back with the values they had

#### Scenario: A block's size can be set in its settings

- **WHEN** the user sets a larger size in a memory block's settings and saves
- **THEN** the block holds that many bytes, the bytes it already held keep
  their addresses, and the bytes it gained are zero

#### Scenario: An assembled block's size is stated, not offered

- **WHEN** the user opens the settings of a block whose bytes come from its
  assembly source
- **THEN** the settings state how many bytes it holds and do not offer to
  change that number

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

### Requirement: A saved data file can be copied into a block

From a file a running program saved, the user SHALL be able to make a block of
memory holding a copy of that file's bytes, without leaving the IDE and without
routing the bytes through a download. The bytes copied SHALL be the file the
program saved, not any container the machine wrapped around it — what the user
was shown is what the block holds.

The new block SHALL be part of the document like any other: named, at an
address, autosaved, saved, shared, checked before a run and loaded into memory
with the program. Because the address it starts at is a suggestion rather than a
choice the user has made, its settings SHALL be open on it as soon as it is
made, so the name and load address can be corrected before anything else
happens; a placement that conflicts with another block SHALL be reported as any
other conflicting placement is.

The file SHALL be unaffected by the copy: still readable by the running program,
still shown as its own tab, and still discarded when a run, a reset, a machine
change or a different program discards it. Copying SHALL NOT make the file part
of the document, and a block SHALL NOT be convertible back into a file.

#### Scenario: The copy holds the file's bytes

- **WHEN** the user copies a saved data file into a block
- **THEN** a block exists holding exactly the bytes that file's tab showed

#### Scenario: The block's settings open on it

- **WHEN** the user copies a saved data file into a block
- **THEN** that block's tab is shown with its settings open, so its name and
  load address can be set straight away

#### Scenario: The file survives the copy

- **WHEN** the user copies a saved data file into a block
- **THEN** the file is still shown as its own tab and the running program can
  still load it

#### Scenario: The block outlives the file

- **WHEN** the user copies a saved data file into a block and then runs the
  program again
- **THEN** the file is discarded with the last run's output and the block is
  still part of the document

### Requirement: A block can be created as either kind

Creating a block SHALL offer both of the kinds a block can be — machine code
edited as assembly, and a block of memory edited as bytes — so a block of data
is made as one rather than made as code and converted. A block created as memory
SHALL open on its bytes and carry no assembly source; a block created as code
SHALL open on its assembly, as it does today.

#### Scenario: A block created as memory

- **WHEN** the user creates a new block of memory
- **THEN** it opens in the byte editor, with no assembly source of its own

#### Scenario: A block created as code

- **WHEN** the user creates a new machine code block
- **THEN** it opens in the assembly editor, as it did before either kind could
  be created directly

### Requirement: A block's editor says where the block sits

A block opened in an editor SHALL be described by a single bar above its
contents, whichever editor it opens in. That bar SHALL state the range of
addresses the block occupies — the address of its first byte and of its last —
how many bytes that is, and the block's entry point and comment where it has
them. A block that holds no bytes occupies no range, and SHALL be described by
its address alone.

The bar SHALL NOT repeat the block's name. The block's tab carries the name,
directly above the bar, and is the thing the user selected to arrive there.

Where the two byte views cannot both be shown, the choice between them SHALL be
offered within that same bar rather than in a strip of its own, so that a
narrow window spends one row on describing the block and choosing a view, not
two.

#### Scenario: The editor names the addresses the block occupies

- **WHEN** the user opens a block of 174 bytes loaded at $8000
- **THEN** its editor states that it occupies $8000 to $80AD

#### Scenario: An empty block is described by its address

- **WHEN** the user opens a block that holds no bytes
- **THEN** its editor states the address the block sits at and no range

#### Scenario: The block's name is shown once

- **WHEN** the user opens a block in either editor
- **THEN** its name appears on its tab and is not repeated in the bar below it

#### Scenario: A narrow window offers the view choice in the same bar

- **WHEN** the window is too narrow to show the hexadecimal and character views
  together
- **THEN** the choice between them is offered in the bar that describes the
  block, and no further row is spent on it
