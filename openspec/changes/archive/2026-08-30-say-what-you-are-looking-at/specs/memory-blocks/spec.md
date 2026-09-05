## ADDED Requirements

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

## MODIFIED Requirements

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
