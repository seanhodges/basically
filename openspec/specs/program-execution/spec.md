# program-execution Specification

## Purpose

Run the current program on an authentic in-browser emulation of the selected
machine: one action takes the editor's source to a running program on the
machine's screen, with sound, adjustable speed, and a line-level debugger
where the machine supports one.

## Requirements

### Requirement: One action runs the current source

A single Run action SHALL tokenize the current source, load it into the
machine (booting the machine first if needed), and start it running, without
the user performing any machine-side loading steps.

Where the machine runs a ROM image the user can supply, and no image is
available to boot from, the IDE SHALL say that the machine's ROM image is
unavailable and point the user at supplying their own, rather than reporting a
bare fetch failure. Where a run fails while an image the user supplied is in
force, the IDE SHALL say that too, so a ROM that does not work can be told
apart from a program that does not work.

#### Scenario: Run from the editor

- **WHEN** the user invokes Run on a valid program
- **THEN** the program is executing on the emulated machine within the
  emulator pane

#### Scenario: The machine has no ROM image to boot from

- **WHEN** the user runs a program on a machine whose ROM image is unavailable
- **THEN** they are told the image is unavailable and that they can supply their
  own, rather than being shown a fetch failure

#### Scenario: A run fails while a supplied ROM is in force

- **WHEN** a run fails on a machine running a ROM image the user supplied
- **THEN** the IDE reports that a supplied image is in use, so it can be told
  apart from a fault in the program

### Requirement: Runs are gated on known-bad input

The Run action SHALL refuse to start when the source has lint errors (while
the lint gate setting is enabled) or when the document's memory blocks
conflict with the machine or the program, and SHALL tell the user why.

#### Scenario: Lint error blocks the run

- **WHEN** the user invokes Run while the source has a tokenizer error
- **THEN** no program is loaded and the error is surfaced instead

### Requirement: Emulation runs at authentic speed with sound

While running, the machine SHALL advance in display-frame steps at the
machine's native rate, render to the visible screen each frame, and play the
machine's sound where the machine produces any. The user SHALL be able to
scale emulation speed and mute or adjust the volume.

#### Scenario: Speed multiplier

- **WHEN** the user sets the emulator speed to a multiple of real time
- **THEN** the running program advances proportionally faster or slower

### Requirement: The machine accepts live input

A running program SHALL receive keyboard input from the user's physical
keyboard and from the on-screen input devices, and joystick input where the
machine has a joystick interface.

#### Scenario: Typing into a running program

- **WHEN** a running program waits for input and the user types on their
  keyboard
- **THEN** the program receives the machine's corresponding key presses

### Requirement: Runtime state is visible to the IDE

Where the machine can introspect them, the IDE SHALL surface the running
program's BASIC runtime report (errors), its variables, its actual RAM usage,
and the contents of its screen as text; machines that cannot report a figure
fall back gracefully rather than showing stale data.

Screen text SHALL be the characters the program put on the screen, in reading
order, for every machine that can determine them — including machines whose
display holds no characters, where they SHALL be recovered from what is
displayed.

#### Scenario: Live memory readout

- **WHEN** a program is running on a machine that reports RAM figures
- **THEN** the status display shows the machine's own used/free figures
  instead of the pre-run estimate

#### Scenario: Reading back what a program printed

- **WHEN** a program has printed to the screen on a machine that can report its
  screen as text
- **THEN** the printed characters are available to the IDE in reading order

#### Scenario: A machine whose display holds no characters

- **WHEN** a program has printed to the screen on a machine that stores its
  display only as an image
- **THEN** the printed characters are still reported, recovered from what is
  displayed

#### Scenario: A machine that cannot report its screen

- **WHEN** the IDE asks a machine that cannot determine its screen text
- **THEN** no screen text is reported, and every other runtime figure is
  unaffected

### Requirement: Line-level debugging on capable machines

On machines that support it, the user SHALL be able to set breakpoints on
BASIC line numbers, pause execution before a breakpointed line, see the
paused line highlighted in the editor, and step line by line or continue.

#### Scenario: Hit a breakpoint

- **WHEN** a debugged program reaches a line with a breakpoint
- **THEN** execution pauses before that line and the editor highlights it
