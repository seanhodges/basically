## MODIFIED Requirements

### Requirement: Keyboard works for editor and emulator alike

The virtual keyboard SHALL type into whichever surface has focus: machine key
presses to a running emulator, and the corresponding characters or editing
actions into the code editor.

On every machine whose keyboard has cursor keys, the on-screen keyboard SHALL be
able to press them, reaching the same keys of the machine's own matrix that its
arrow keys reach - including the shift combination, on a machine that produces
its cursor keys that way. A keycap SHALL NOT show a cursor legend while pressing
a different key on the machine. A machine whose keyboard has no cursor keys, or
fewer than four, SHALL offer only the ones it has rather than an invented key.

A machine with no backspace key SHALL offer its own delete key under its own
legend rather than a backspace legend over a different key, and that key SHALL
delete the character at the cursor on the code editor as well as on the machine.

#### Scenario: Typing into the editor

- **WHEN** the editor has focus and the user taps keys on the virtual
  keyboard
- **THEN** the corresponding text appears in the source

#### Scenario: Moving the machine's cursor by touch

- **WHEN** the user runs a program, gives the emulator focus, and taps the
  cursor keys on the on-screen keyboard
- **THEN** the machine's own cursor moves, and none of the characters those
  keycaps carry on their other legends are typed into the program

#### Scenario: A machine that reaches its cursor keys with shift

- **WHEN** the user presses a cursor key on the on-screen keyboard of a machine
  whose cursor keys are a shift combination
- **THEN** the machine sees the same combination its own keyboard would send

#### Scenario: A machine with no cursor keys

- **WHEN** the user opens the on-screen keyboard for a machine whose keyboard
  has no cursor keys
- **THEN** the keyboard offers no cursor keys for it

#### Scenario: Deleting on a machine with no backspace

- **WHEN** the user moves the cursor back over a character on a machine that has
  a delete key but no backspace, and presses that key
- **THEN** the character at the cursor is deleted, and the keycap is labelled as
  the delete key the machine has rather than as a backspace
