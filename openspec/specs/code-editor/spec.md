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

The editor SHALL treat the items of a `DATA` statement the way the dialect's
machine does: as variables where the machine evaluates them, and as values —
never names — where it takes them literally.

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

#### Scenario: DATA items on a machine that takes them literally

- **WHEN** a program lists unquoted words as the items of a `DATA` statement on
  a dialect whose machine READs those items literally
- **THEN** those words are not offered as variable completions and are not
  reported by the editor's variable checks

#### Scenario: DATA items on a machine that evaluates them

- **WHEN** a program names a variable inside a `DATA` statement on a dialect
  whose machine evaluates those items
- **THEN** that name is treated as a use of the variable, offered as a
  completion and checked like any other

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

### Requirement: Find a variable's usages

The editor SHALL let the user pick a variable in the program — by clicking or
tapping it where it is written — and from there see every place that variable is
used. The usages SHALL be highlighted in the text, counted, and navigable, and
the user SHALL be able to dismiss them.

Which occurrences count SHALL follow the active machine rather than the
spelling:

- names SHALL be matched without regard to letter case on the machines whose
  ROM folds it, and with regard to it on the machines that distinguish it;
- on a machine whose ROM keeps only a limited number of a name's characters,
  names the machine cannot tell apart SHALL be reported as one variable;
- a scalar and an array of the same name SHALL be reported as different
  variables, as the machine holds them separately;
- a name that is local to a procedure SHALL be reported only within that
  procedure, and a global name spelled the same SHALL NOT include that
  procedure's local occurrences.

Keyword spellings, text inside string literals and comment text SHALL NOT be
counted as usages of a variable. A word inside a `DATA` statement SHALL be
counted only on the machines whose ROM evaluates its items, and SHALL NOT be on
the machines that take them literally.

Usages SHALL be found in the buffer the editor is showing.

The usages SHALL share the foot of the editor with find/replace rather than
stand alongside it: opening either SHALL take the other away.

#### Scenario: Seeing where a variable is used

- **WHEN** the user picks a variable that the program uses in several places
- **THEN** every one of those places is highlighted and the user is told how
  many there are

#### Scenario: Stepping between usages

- **WHEN** the user asks for the next usage
- **THEN** the editor brings that usage into view and moves the cursor to it,
  continuing from the last usage back to the first

#### Scenario: Letters that are not a variable

- **WHEN** the picked variable's letters also occur inside a keyword, inside a
  string literal, and inside a comment
- **THEN** none of those are highlighted or counted

#### Scenario: A word inside DATA

- **WHEN** the program uses the picked variable's name inside a `DATA`
  statement
- **THEN** it is highlighted only if the machine evaluates its `DATA` items,
  and not if the machine takes them literally

#### Scenario: The same name in a different case

- **WHEN** the program spells the picked variable's name in another letter case
- **THEN** it is highlighted only if the machine treats the two as one
  variable

#### Scenario: Names the machine cannot tell apart

- **WHEN** the user picks a variable on a machine whose ROM keeps only the
  first two characters of a name, and the program also uses a differently
  spelled name that collapses to the same one
- **THEN** both spellings are highlighted, because the machine holds them as a
  single variable

#### Scenario: A name that belongs to a procedure

- **WHEN** the user picks a name that is a procedure's parameter or local
  variable, and the same spelling is also used outside that procedure
- **THEN** only the occurrences inside that procedure are highlighted

#### Scenario: An array and a scalar of the same name

- **WHEN** the user picks an array element, and the program also uses a plain
  variable spelled the same
- **THEN** only the array's occurrences are highlighted

#### Scenario: Dismissing the usages

- **WHEN** the user dismisses the usages, or edits the program
- **THEN** the highlights are removed

#### Scenario: One bar at the foot of the editor

- **WHEN** the user opens find/replace while a variable's usages are shown
- **THEN** the usages, their count and any pending offer are taken away, and
  find/replace takes their place

### Requirement: Look up a keyword in the language reference

The editor SHALL let the user pick a keyword, function name or operator in the program —
by clicking or tapping it where it is written — and from there open the active machine's
language reference showing that keyword. While editing a machine-code block, the editor
SHALL offer the same for an instruction or assembler directive, opening the reference for
that block's processor.

What the editor offers SHALL follow the active machine's own reading of the program text.
Only what that machine reads as a keyword, function, operator or instruction SHALL be
offered; a line number, a number, a variable name, a processor register, text inside a
string literal and text inside a comment SHALL NOT be. Punctuation that separates the
parts of a line SHALL NOT be offered, having nothing to look up.

A keyword written in one of the machine's short spellings — the Acorns' dotted prefix,
the Commodores' shifted letter, a symbol standing for a whole command — SHALL be offered
as the keyword it stands for on that machine, and SHALL open the reference at that
keyword rather than at the spelling. The reference SHALL open at the picked keyword even
where a porting comparison is current, since the user has named what they want to read.

#### Scenario: Looking up a keyword

- **WHEN** the user picks a keyword in their program and takes up the reference offer
- **THEN** the documentation opens at the active machine's reference, showing that
  keyword

#### Scenario: Looking up an operator

- **WHEN** the user picks one of the machine's own operators
- **THEN** the reference offer is made for it, as it is for a keyword

#### Scenario: Looking up a machine-code instruction

- **WHEN** the user picks an instruction or an assembler directive while editing a
  machine-code block
- **THEN** the documentation opens at the reference for that block's processor, showing
  that instruction

#### Scenario: A keyword typed in a short spelling

- **WHEN** the user picks a keyword written in one of the machine's short spellings, as
  a listing prints it
- **THEN** the documentation opens at the keyword that spelling stands for on this
  machine

#### Scenario: Text that is not a keyword

- **WHEN** the user picks a word inside a string literal or a comment, a line number, a
  variable name, or punctuation separating the parts of a line
- **THEN** no reference offer is made

#### Scenario: A keyword lookup while a porting comparison is current

- **WHEN** a porting comparison is current for the open program and the user picks a
  keyword and takes up the reference offer
- **THEN** the documentation opens at that keyword rather than at the comparison

### Requirement: Short spellings are read as the keywords they are

Where a machine lets a program spell a keyword short, the editor SHALL read such a
spelling as that keyword throughout: it SHALL be coloured as the keyword it stands for
rather than as a name or as punctuation, and the letters that make it up SHALL NOT be
reported as a variable.

Which spellings a machine accepts, and which keyword each stands for, SHALL follow that
machine's own resolution order rather than a shared rule — a prefix takes the first
keyword its ROM scans that begins with it, and a prefix that spells a whole keyword is
that keyword rather than an abbreviation.

#### Scenario: A dotted listing

- **WHEN** the user opens a listing on a machine that abbreviates with a trailing dot,
  and it spells a command short
- **THEN** that spelling is coloured as the command, and its leading letters are not
  reported as a variable

#### Scenario: A shifted-letter listing

- **WHEN** the user opens a listing on a machine that abbreviates with a shifted letter,
  and it spells a command short before its arguments
- **THEN** the spelling is coloured as the command and what follows it is read as the
  command's arguments, rather than the whole run being read as one name

#### Scenario: A symbol standing for a whole command

- **WHEN** the program uses a symbol the machine reads as a whole command
- **THEN** it is coloured as that command, and where the command is a comment marker the
  rest of the line is coloured as a comment

#### Scenario: A prefix that spells a whole keyword

- **WHEN** a prefix that could abbreviate a longer keyword is itself a whole keyword on
  this machine
- **THEN** it is read as the whole keyword it spells, not as the abbreviation

### Requirement: One menu for what the picked text can answer

Where picking a token in the program can answer more than one question about it, the
editor SHALL present those offers together in one menu, opened where the token is
written. A question the picked token cannot answer SHALL NOT be offered.

The menu SHALL be dismissible by Escape while it is open, and that keypress SHALL NOT
also dismiss whatever surface stands behind the editor.

#### Scenario: The offers a variable can answer

- **WHEN** the user picks a variable
- **THEN** the menu offers to show where that variable is used, and makes no reference
  offer

#### Scenario: The offers a keyword can answer

- **WHEN** the user picks a keyword
- **THEN** the menu offers the language reference, and does not offer to show usages

#### Scenario: Dismissing the menu

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes, and nothing behind it is dismissed by the same keypress

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
