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

#### Scenario: Machine-specific legend

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** the keyboard redraws with the new machine's layout and legends

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
