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
A statement that does not open the way the machine requires SHALL be reported
once, and reported alike wherever on the line it sits — the first statement is
not held to a different standard from the ones that follow it.

Where the active dialect's machine takes only one statement per line, a line
carrying more than one SHALL be reported, at the point the second statement
begins. A separator character appearing as ordinary text — inside a string or a
comment — SHALL NOT be reported.

A diagnostic's reported position SHALL account for any leading whitespace on
the line, so an indented line's errors are marked at the characters they
actually refer to.

A statement-shape diagnostic — a report that a statement does not open the way
the machine requires, or that a line carries more statements than the machine
allows — SHALL NOT by itself prevent the program from being built or exported,
since the machine would store such a line and object only when it runs.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

#### Scenario: A bad statement after a separator

- **WHEN** the user writes a line whose first statement is valid but whose
  second statement, after the machine's statement separator, does not open with
  a valid statement keyword
- **THEN** an inline diagnostic marks that second statement

#### Scenario: A bad statement opening the line

- **WHEN** the first statement on a line does not open with a valid statement
  keyword
- **THEN** one inline diagnostic marks it, and the program still builds and can
  still be exported

#### Scenario: A valid multi-statement line is clean

- **WHEN** the user writes a line of several valid statements separated by the
  machine's separator, including empty statements and a trailing separator
- **THEN** no diagnostic is reported for that line

#### Scenario: Several statements on a one-statement-per-line machine

- **WHEN** the active machine takes only one statement per line and the user
  writes a line carrying several
- **THEN** one inline diagnostic marks the line where its second statement
  begins, and the program still builds and can still be exported

#### Scenario: The separator as ordinary text

- **WHEN** the active machine takes only one statement per line and the
  separator character of another machine appears inside a string or a comment
- **THEN** nothing is reported for that line

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

The figure it is shown against SHALL be the RAM the machine itself leaves free
for a BASIC program at its Ready prompt, on the machine as the IDE emulates it.
It SHALL NOT exceed what that machine reports free, so a program the IDE says
fits is a program the machine can hold. It MAY be smaller where the machine
spends RAM out of the program area as a program runs — a display file that grows
with the screen, for instance — so that the headroom shown is headroom a running
program still has.

#### Scenario: Growing program

- **WHEN** the user adds lines to the program
- **THEN** the byte counter updates to reflect the new tokenized size

#### Scenario: The budget matches the machine

- **WHEN** the user compares the budget shown while editing with the free figure
  the same machine reports once it is running
- **THEN** the two agree, rather than the budget promising memory the machine
  does not have

#### Scenario: Changing machine changes the budget

- **WHEN** the user switches the program to a machine with less program RAM
- **THEN** the same program is measured against the new machine's smaller figure,
  and reports as closer to full

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

### Requirement: Disposable scratch buffers

The editor SHALL let the user create scratch buffers: additional BASIC buffers,
held alongside the program, for writing code that is not part of the document.
The user SHALL be able to hold several at once, choose which one the editor
shows, rename one, and close one without being asked to confirm.

A scratch buffer SHALL offer the same editing the program does — the active
dialect's highlighting, completion, inline diagnostics and line-number
management — since it holds the same kind of code.

Editing a scratch buffer SHALL NOT alter the program, SHALL NOT mark the
document as having unsaved changes, and SHALL NOT change what saving, sharing or
exporting the document produces. Which buffer the editor is showing SHALL be
apparent to the user.

Closing a scratch buffer SHALL discard it and everything attached to it.

#### Scenario: A snippet is written without touching the program

- **WHEN** the user creates a scratch buffer and types a program into it
- **THEN** the document's own source is unchanged and the document is not marked
  as having unsaved changes

#### Scenario: Several scratch buffers at once

- **WHEN** the user creates more than one scratch buffer
- **THEN** each keeps its own contents, and choosing one shows that one's
  contents in the editor

#### Scenario: A scratch buffer is edited like the program

- **WHEN** the user types an invalid statement into a scratch buffer
- **THEN** it is diagnosed inline exactly as the same statement would be in the
  program

#### Scenario: Saving while a scratch buffer is showing

- **WHEN** the user saves or shares the document while a scratch buffer is the
  one on screen
- **THEN** what is saved or shared is the program, not the scratch buffer

#### Scenario: Closing a scratch buffer

- **WHEN** the user closes a scratch buffer
- **THEN** it is discarded without a confirmation step, and the program and any
  other scratch buffers are unaffected
