## MODIFIED Requirements

### Requirement: Keyboard works for editor and emulator alike

The virtual keyboard SHALL type into whichever surface has focus: machine key
presses to a running emulator, and the corresponding characters or editing
actions into the code editor.

One tap on an on-screen key SHALL send one keypress to the machine, however long
the pointer rests on it: where a machine's own firmware repeats a held key
sooner than a fingertip reliably lifts, the keyboard SHALL end the press before
that repeat rather than let a tap arrive as several characters. A key whose
press has ended SHALL stop showing as pressed, and SHALL NOT repeat again until
the user taps it again. This SHALL NOT change what the machine does with a key
held down from a physical keyboard, which repeats at the machine's own rate.

Function keys and modifier keys SHALL be exempt: they stay held for as long as
the touch stays on them, because programs read function keys as held state and a
modifier has to outlast the key it modifies.

#### Scenario: Typing into the editor

- **WHEN** the editor has focus and the user taps keys on the virtual
  keyboard
- **THEN** the corresponding text appears in the source

#### Scenario: A finger resting on a key

- **WHEN** the user presses a key on the on-screen keyboard of a machine whose
  firmware auto-repeats, and leaves the finger on it well past the point where
  the machine would start repeating
- **THEN** the machine receives that character once

#### Scenario: Tapping again sends another

- **WHEN** the user lifts and taps the same key again
- **THEN** the machine receives the character a second time
