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

#### Scenario: Run from the editor

- **WHEN** the user invokes Run on a valid program
- **THEN** the program is executing on the emulated machine within the
  emulator pane

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
program's BASIC runtime report (errors), its variables, and its actual RAM
usage; machines that cannot report a figure fall back gracefully rather than
showing stale data.

#### Scenario: Live memory readout

- **WHEN** a program is running on a machine that reports RAM figures
- **THEN** the status display shows the machine's own used/free figures
  instead of the pre-run estimate

### Requirement: Line-level debugging on capable machines

On machines that support it, the user SHALL be able to set breakpoints on
BASIC line numbers, pause execution before a breakpointed line, see the
paused line highlighted in the editor, and step line by line or continue.

#### Scenario: Hit a breakpoint

- **WHEN** a debugged program reaches a line with a breakpoint
- **THEN** execution pauses before that line and the editor highlights it
