## MODIFIED Requirements

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
