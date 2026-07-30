# code-editor Specification

## Purpose

Give every dialect a first-class BASIC editing experience from one generic
editor: authentic keyword highlighting, dialect-aware completion, inline
diagnostics as you type, and line-number management — all driven by the
active dialect's own data, with no per-machine editor code.

## Requirements

### Requirement: Dialect-aware highlighting and completion

The editor SHALL highlight the active dialect's keywords and offer completion
for its keywords, the program's own variables, and common statement
constructs. For dialects whose machines ignore spacing when tokenizing, the
editor SHALL recognise keywords the same way the machine would (e.g. keywords
embedded in identifier runs).

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

### Requirement: Machine graphics characters are legible

Every character the active machine's character set can express SHALL be
displayed as its own shape wherever the IDE shows program text, rather than as a
missing-glyph box, and SHALL NOT depend on which fonts are installed on the
user's device.

Displaying a graphics character SHALL NOT change the height or alignment of the
line it appears on, and SHALL NOT dim it relative to the program text around it.

#### Scenario: Block graphics on a device without a suitable font

- **WHEN** the user opens a program containing the machine's block graphics on a
  device whose installed fonts do not cover them
- **THEN** the graphics are shown as their actual shapes

#### Scenario: A graphics character does not disturb the line

- **WHEN** a graphics character is inserted into a line of an otherwise plain
  program
- **THEN** that line keeps the same height and stays aligned with its line
  number and with the lines around it

#### Scenario: A graphics character is as readable as the code around it

- **WHEN** a program containing machine graphics characters is shown in the
  editor
- **THEN** those characters are drawn in the same weight of colour as the
  program's literals, not in the muted style the editor uses for text it does
  not recognise

### Requirement: Inline diagnostics while typing

The editor SHALL run the dialect's linter as the user types (debounced) and
display each error inline at its line and column, without a manual check step.

Where the active dialect's machine allows several statements on one line, the
linter SHALL apply its statement checks to every statement on the line, not
only the first, including a statement introduced by a conditional's `THEN`.

A diagnostic's reported position SHALL account for any leading whitespace on
the line, so an indented line's errors are marked at the characters they
actually refer to.

A statement-shape diagnostic — a report that a statement does not open the way
the machine requires — SHALL NOT by itself prevent the program from being built
or exported, since the machine would store such a line and object only when it
runs.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

#### Scenario: A bad statement after a separator

- **WHEN** the user writes a line whose first statement is valid but whose
  second statement, after the machine's statement separator, does not open with
  a valid statement keyword
- **THEN** an inline diagnostic marks that second statement

#### Scenario: A valid multi-statement line is clean

- **WHEN** the user writes a line of several valid statements separated by the
  machine's separator, including empty statements and a trailing separator
- **THEN** no diagnostic is reported for that line

#### Scenario: An indented line marks the right characters

- **WHEN** an invalid statement appears on a line that begins with whitespace
- **THEN** the diagnostic is positioned at the offending token, not displaced
  by the width of the indent

#### Scenario: A statement-shape error still runs

- **WHEN** a program's only diagnostics are statement-shape reports
- **THEN** the program still builds a runnable image and can still be exported
  to hardware

### Requirement: The RAM budget is always visible

The IDE SHALL continuously show the tokenized program's byte size against the
machine's available program RAM, so the user can see headroom before running.

#### Scenario: Growing program

- **WHEN** the user adds lines to the program
- **THEN** the byte counter updates to reflect the new tokenized size

### Requirement: Line-number management

The editor SHALL support automatic line numbering while typing and a
renumbering command that rewrites line numbers (and, where the dialect uses
them, line-number references) consistently.

#### Scenario: Renumber a program

- **WHEN** the user renumbers a program
- **THEN** lines are renumbered in even increments and remain in the same
  order, and the program still tokenizes cleanly

### Requirement: Opaque binary lines display as chips

On dialects that support opaque binary line records, the editor SHALL
collapse each record to a compact chip rather than exposing raw encoded text,
while keeping the record intact in the underlying document.

#### Scenario: Imported program with machine code

- **WHEN** the user imports a program containing binary line records
- **THEN** each record shows as a chip in the editor and the program still
  runs with its machine code intact

### Requirement: Display control codes show as chips

Where a dialect writes the machine's display control codes as named escapes in
program text, the editor SHALL show each one as a compact chip picturing what
the code does — including the colour it selects, where it selects one — rather
than as its name spelled out across the line.

The program text SHALL be unchanged by this: the escape still reads, exports
and tokenizes exactly as written, and a chip SHALL be one unit for cursor
movement and deletion, so a single delete removes the whole escape and no edit
can leave part of one behind.

A chip SHALL NOT change the height or alignment of the line it appears on.

An escape the dialect does not name — a raw byte written as its code — SHALL
stay visible as text, so that what it stores is never hidden.

#### Scenario: A teletext colour code in a string

- **WHEN** the user opens a program whose strings carry the machine's display
  control codes
- **THEN** each control code shows as a chip identifying it, and the line
  keeps the height and alignment of the lines around it

#### Scenario: Deleting a control code

- **WHEN** the user puts the cursor after a control-code chip and deletes once
- **THEN** the whole control code is removed from the program, leaving no part
  of the escape behind

#### Scenario: The program text is what was written

- **WHEN** the user runs or exports a program containing control-code chips
- **THEN** the machine receives exactly the bytes the escapes stand for

### Requirement: Program structure at a glance

The editor SHALL offer an outline of the program's structure (such as
procedures, subroutines, or jump targets appropriate to the dialect) that the
user can navigate from.

#### Scenario: Jump from the outline

- **WHEN** the user picks an entry in the program outline
- **THEN** the editor moves the cursor to that line
