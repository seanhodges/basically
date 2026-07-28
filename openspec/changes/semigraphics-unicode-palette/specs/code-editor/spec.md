## ADDED Requirements

### Requirement: Machine graphics characters are legible

Every character the active machine's character set can express SHALL be
displayed as its own shape wherever the IDE shows program text, rather than as a
missing-glyph box, and SHALL NOT depend on which fonts are installed on the
user's device.

Displaying a graphics character SHALL NOT change the height or alignment of the
line it appears on.

#### Scenario: Block graphics on a device without a suitable font

- **WHEN** the user opens a program containing the machine's block graphics on a
  device whose installed fonts do not cover them
- **THEN** the graphics are shown as their actual shapes

#### Scenario: A graphics character does not disturb the line

- **WHEN** a graphics character is inserted into a line of an otherwise plain
  program
- **THEN** that line keeps the same height and stays aligned with its line
  number and with the lines around it
