## MODIFIED Requirements

### Requirement: Charset mapping is bidirectional

Each dialect SHALL map its machine character codes to unicode (block graphics
and escape sequences) and back, so that a program written with those
characters displays faithfully in the editor and encodes correctly on the
machine.

Where unicode provides an exact character for one of the machine's graphics
glyphs, that character SHALL be the canonical text form the dialect produces
when it renders that code. A spelling that was canonical before SHALL still be
accepted when reading a program, and SHALL encode to the same machine code, so
that no previously saved program becomes unreadable.

A graphics character the machine stores as one byte SHALL be one character in
the editor, including where the machine's own shape for it is undefined (the
user-defined graphics), so that editing cannot leave half of one behind.

#### Scenario: Block graphics survive the round trip

- **WHEN** the user writes a program using the dialect's block-graphic
  characters and runs it
- **THEN** the emulator screen shows the same graphics the editor showed

#### Scenario: A graphics character has one canonical form

- **WHEN** a program containing a machine graphics character that unicode can
  express exactly is rendered into the editor
- **THEN** it appears as that unicode character rather than as an escape
  sequence

#### Scenario: An older spelling still loads

- **WHEN** the user opens a program that spells a graphics character the way
  the dialect used to render it
- **THEN** the program loads, that character encodes to the same machine code
  as before, and it is shown in the canonical form

#### Scenario: A user-defined graphic is a single character

- **WHEN** the user inserts one of the machine's user-defined graphics and then
  deletes it with a single backspace
- **THEN** the whole graphic is removed, leaving no fragment of it in the
  program
