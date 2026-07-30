# virtual-input Specification

## Purpose

Put the real machine's input devices on screen: an authentic per-machine
virtual keyboard and a virtual game controller, usable by touch or mouse,
driven entirely by per-dialect layout data so the input code itself contains
no machine specifics.
## Requirements
### Requirement: Authentic per-machine keyboard

The on-screen keyboard SHALL reproduce the active machine's real key layout,
legends, and glyphs (including shifted layers and keyword legends where the
machine has them), and pressing a key SHALL drive the emulated machine's own
key matrix.

Where the machine's character set contains graphics characters, the on-screen
keyboard SHALL offer them as a palette rather than as key legends: every
graphics character the machine can express, each shown large enough to
distinguish from the others, and each labelled with how the machine itself
reaches it — the physical key it lives on, or, where the machine printed no
graphics on its keyboard, the character code its BASIC would use — so the
palette teaches the machine rather than the IDE. The palette SHALL adapt the
number of characters it shows per row to the space available, without changing
how large each character is drawn.

Where the machine displays its graphics characters as graphics only after a
display control code, the palette SHALL also offer those control codes, placed
ahead of the characters they enable, and SHALL say that the characters need
one — so a user who takes a character from the palette can make it appear. A
control code SHALL be offered as a picture of what it does rather than as its
name spelled out, and SHALL be labelled with the character code that produces
it, like any other cell on such a machine. The palette SHALL NOT offer a
control code that would stop the machine displaying those characters as
graphics.

The palette SHALL draw every machine's graphics characters the same way round as
the editor draws them - dark ink on light ground - whatever colours that
machine's own screen uses, because the palette is a preview of the text that
lands in the editor. A cell SHALL NOT read as the inverse of the character it
inserts.

Where the palette holds more characters than fit at once, it SHALL scroll, and
scrolling it SHALL NOT insert anything: a character is inserted by a tap that
stays on it, not by touching it.

#### Scenario: Machine-specific legend

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** the keyboard redraws with the new machine's layout and legends

#### Scenario: Inserting a graphics character

- **WHEN** the user selects the graphics palette with the editor focused and
  picks a character
- **THEN** that character is inserted into the source, and the program still
  tokenizes

#### Scenario: A palette cell reads the same way as the editor

- **WHEN** the user compares a half-block character in the graphics palette with
  the same character after inserting it, on any machine that has a palette
- **THEN** the same half of the cell carries the ink in both

#### Scenario: Scrolling past the characters that do not fit

- **WHEN** the user drags the graphics palette to reach the characters below
  the ones on screen
- **THEN** the palette scrolls and nothing is inserted into the source

#### Scenario: The palette shows where a character lives

- **WHEN** the user looks at a character in the graphics palette on a machine
  whose keyboard produces it
- **THEN** it is labelled with the key, and any modifier, that produces it on
  the real machine

#### Scenario: The palette shows how to reach a character with no key

- **WHEN** the user looks at a character in the graphics palette on a machine
  that printed no graphics on its keyboard
- **THEN** it is labelled with the character code that machine's BASIC uses to
  produce it

#### Scenario: The palette offers the control code a graphics character needs

- **WHEN** the user opens the graphics palette on a machine whose graphics
  characters display as graphics only after a display control code, and picks
  that control code and then a graphics character
- **THEN** both are inserted into the source, and running the program shows the
  graphics character as graphics

#### Scenario: The palette says a graphics character needs a mode set first

- **WHEN** the user looks at the graphics characters of such a machine in the
  palette
- **THEN** the palette states that they display as graphics only after one of
  the control codes it offers ahead of them

#### Scenario: The palette adapts to the space available

- **WHEN** the user opens the graphics palette on a narrow screen and on a wide
  one
- **THEN** fewer characters appear per row on the narrow screen, and the
  characters are drawn at a comparable size on both

### Requirement: Keyboard works for editor and emulator alike

The virtual keyboard SHALL type into whichever surface has focus: machine key
presses to a running emulator, and the corresponding characters or editing
actions into the code editor.

#### Scenario: Typing into the editor

- **WHEN** the editor has focus and the user taps keys on the virtual
  keyboard
- **THEN** the corresponding text appears in the source

### Requirement: Game controller with per-machine mapping

The virtual game controller SHALL offer a d-pad and fire button(s) whose
inputs reach the running program either through the machine's own joystick
hardware (where the machine has a joystick interface the user selected) or as
mapped key presses. A machine that cannot service the chosen joystick mode
SHALL fall back to key mapping rather than losing input.

#### Scenario: Joystick-less machine

- **WHEN** the user plays with the controller on a machine with no usable
  joystick interface
- **THEN** the controller's inputs arrive as the mapped keys

### Requirement: Controller bindings are configurable

The user SHALL be able to remap controller roles (directions and fire
buttons) per machine, choose 4-way or 8-way d-pad behaviour, and choose the
number of fire buttons; these preferences persist.

#### Scenario: Remap fire

- **WHEN** the user binds the fire role to a different machine key and plays
  a game that reads that key
- **THEN** pressing fire on the controller triggers the newly bound key

### Requirement: Touch feedback

Virtual key presses SHALL offer optional audible click and haptic feedback,
each independently switchable.

#### Scenario: Silent keyboard

- **WHEN** the user disables keyboard sound
- **THEN** taps produce no click while haptics (if enabled) still fire

