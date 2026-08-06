## ADDED Requirements

### Requirement: Blocks are editable as bytes

A block that is not editable as assembly — a data block, or a code block for a
CPU the IDE has no assembler for — SHALL be editable as bytes in its own tab,
showing each byte's address, its value, and the character the machine's own
character set gives it.

Byte editing SHALL be overwrite-only: typing over a byte SHALL change its value
and SHALL NOT move any other byte. Changing a block's length SHALL be a separate,
deliberate action, and shrinking a block SHALL be confirmed before data is lost.

The user SHALL be able to fill a range of bytes with a chosen value, and to
replace a block's contents from a file.

A character typed into the character column SHALL be encoded through the
machine's own character set; a character that machine cannot represent SHALL be
refused visibly rather than stored as something else.

Byte edits SHALL be undoable within the block being edited, without disturbing
the editing history of the BASIC program.

Editing bytes SHALL be possible on a touch screen as well as with a keyboard.

#### Scenario: A data block can be edited

- **WHEN** the user opens the tab of a block that holds data rather than code
- **THEN** they can see its bytes with their addresses and change them

#### Scenario: Editing a byte leaves its neighbours where they are

- **WHEN** the user types a new value over a byte in the middle of a block
- **THEN** that byte changes and every other byte keeps its address

#### Scenario: Shrinking a block is confirmed

- **WHEN** the user reduces a block's length
- **THEN** they are asked before the bytes past the new end are discarded

#### Scenario: A character the machine cannot represent is refused

- **WHEN** the user types a character with no code in the machine's character
  set into the character column
- **THEN** the block is unchanged and the refusal is visible

#### Scenario: Bytes can be loaded from a file

- **WHEN** the user loads a file of bytes into a block
- **THEN** the block holds those bytes, at its own address
