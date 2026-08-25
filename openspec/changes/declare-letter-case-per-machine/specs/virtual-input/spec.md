## ADDED Requirements

### Requirement: Both letter cases are reachable where the machine has them

On every machine whose character generator can draw lower case, the on-screen
keyboard SHALL be able to type both cases, by the route the machine itself uses:
a shifted letter where that is how the machine gives the other case, or the
machine's own case-lock key where it has one. A machine whose character
generator has no lower case SHALL NOT be given a way to type one.

A keycap SHALL show the case it will type. Where the machine's case changes what
an unshifted letter key produces, the keycaps SHALL follow, so the keyboard never
shows one case while typing the other.

A key that locks case SHALL be distinguished from a modifier: pressing it SHALL
reach the machine's own case key rather than holding a modifier down, and its
effect SHALL persist after it is released until it is pressed again.

The case a keyboard offers before anything is pressed SHALL be the case the
machine produces when it has just started.

#### Scenario: A machine that gives its other case with shift

- **WHEN** the user presses shift and a letter key on the on-screen keyboard of a
  machine whose shifted letters are the other case
- **THEN** the other case is typed, and the keycap showed that case before it was
  pressed

#### Scenario: A machine with a case-lock key

- **WHEN** the user presses the case-lock keycap on a machine that has one, and
  then presses a letter key
- **THEN** the letter is typed in the other case, the letter keycaps show that
  case, and the machine's own case key was pressed rather than a modifier held

#### Scenario: A machine with no lower case

- **WHEN** the user opens the on-screen keyboard for a machine whose character
  generator has no lower case
- **THEN** the keyboard offers neither a case pair on its letter keys nor a
  case-lock key

#### Scenario: A machine whose unshifted letters are lower case

- **WHEN** the user opens the on-screen keyboard for a machine that produces
  lower case from an unshifted letter key when it has just started
- **THEN** the letter keycaps show lower case, and tapping one types lower case

### Requirement: Strict characters removes the case affordance, not the keyboard

While the Strict characters setting is on and the target machine has no lower
case, the on-screen keyboard SHALL offer no way to shift letter case: the shift
key SHALL NOT be offered, and what the keyboard types into the editor SHALL be
upper case.

This SHALL cost the user no character and no function. Where a machine's shift
key carries something other than letter case — a symbol page, a cursor set, a
control modifier, or a combination the machine's own keys produce — that route
SHALL remain available. A key that is not the machine's shift SHALL NOT be
hidden by this setting, however it is styled.

The keyboard's shape SHALL NOT change: hiding the shift key SHALL leave the rows
laid out as they were, rather than reflowing the keys around the gap.

While the setting is off, or on a machine that has lower case, the keyboard
SHALL be unaffected.

#### Scenario: A machine with no lower case, strictly

- **WHEN** Strict characters is on and the user opens the on-screen keyboard for
  a machine with no lower case
- **THEN** no shift key is offered, the letters type in upper case, and the rows
  are laid out as they were

#### Scenario: The symbol page survives

- **WHEN** Strict characters is on for a machine whose shift key is also the way
  to reach a second page of symbols
- **THEN** that page is still reachable, and every symbol the keyboard offered
  before is still reachable

#### Scenario: A control modifier is not a shift

- **WHEN** Strict characters is on for a machine carrying a control key that is
  styled like its shift
- **THEN** the control key is still offered, and the combinations it produces
  still work

#### Scenario: A machine that has lower case

- **WHEN** Strict characters is on and the target machine can draw lower case
- **THEN** the keyboard is unchanged, and both cases remain reachable

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

The letter case a keycap shows SHALL be the case it types into the editor. On a
running machine the case belongs to the machine, whose own keys the keyboard
presses; where the keyboard's idea of the case and the machine's can differ, the
keyboard SHALL return to the machine's starting case rather than keeping a stale
one.

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

#### Scenario: The case a keycap shows is the case it types

- **WHEN** the user changes the keyboard's letter case and taps a letter key with
  the editor focused
- **THEN** the character inserted is in the case the keycap was showing
