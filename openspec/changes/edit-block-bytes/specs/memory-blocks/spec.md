## ADDED Requirements

### Requirement: Blocks are editable as bytes

A block that is not editable as assembly — a data block, or a code block for a
CPU the IDE has no assembler for — SHALL be editable as bytes in its own tab,
showing each byte's address, its value in hexadecimal, and the character the
machine's own character set gives it.

The hexadecimal and character views SHALL be two views of the same bytes, lined
up row by row against the addresses those bytes occupy. Both SHALL be shown
together where there is room for them and offered as alternatives where there is
not. A change made through either view SHALL be reflected in the other as soon
as it is made, and undoing it SHALL undo it in both.

Byte editing SHALL be overwrite-only: entering a new value for a byte SHALL NOT
move any other byte. Changing a block's length SHALL be a separate, deliberate
action, and shrinking a block SHALL be confirmed before data is lost.

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

#### Scenario: A data block can be edited

- **WHEN** the user opens the tab of a block that holds data rather than code
- **THEN** they can see its bytes with their addresses and change them

#### Scenario: The two views stay in step

- **WHEN** the user changes a byte through one of the two views
- **THEN** the other view shows the new value for that byte immediately

#### Scenario: Editing a byte leaves its neighbours where they are

- **WHEN** the user enters a new value over a byte in the middle of a block
- **THEN** that byte changes and every other byte keeps its address

#### Scenario: Shrinking a block is confirmed

- **WHEN** the user reduces a block's length
- **THEN** they are asked before the bytes past the new end are discarded

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
