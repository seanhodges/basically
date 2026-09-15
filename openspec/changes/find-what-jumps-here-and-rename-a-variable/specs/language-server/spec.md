## MODIFIED Requirements

### Requirement: A jump target can be reached from where it is named

The server SHALL take the user from where a destination is named to where it is
defined: from a line number written as a jump or a reference to that line, and
from a named procedure or function to where it is defined. A line number that no
line in the program has SHALL take the user nowhere rather than somewhere near.
A number that is not a line reference SHALL NOT be treated as one.

The server SHALL also take the user the other way, reporting every place a line
is jumped to from the line itself or from any mention of its number. Each place
a jump names that line SHALL be reported, including each target of a jump that
names several. A number that is not a line reference SHALL NOT be reported as
one, and neither SHALL a number appearing inside a string, a comment or a
directive.

What counts as a jump SHALL be the same in both directions, so that a place the
user can jump from is a place reported as jumping.

#### Scenario: Jumping to a line

- **WHEN** the user asks to go to the definition at a line number written as a
  jump
- **THEN** the editor moves to the line bearing that number

#### Scenario: Jumping to a procedure

- **WHEN** the user asks to go to the definition at a named procedure call on a
  machine that has procedures
- **THEN** the editor moves to where that procedure is defined

#### Scenario: A destination that is not there

- **WHEN** the user asks to go to the definition at a line number no line has
- **THEN** the editor moves nowhere, and does not offer a nearby line instead

#### Scenario: Finding what jumps to a line

- **WHEN** the user asks what reaches a line, at a line number a jump names
- **THEN** every place the program jumps to that line is reported

#### Scenario: A jump that names several lines

- **WHEN** a program chooses between several lines in one jump, and the user asks
  what reaches one of them
- **THEN** that jump is reported, as a jump to the line asked about

#### Scenario: A number that only looks like a jump

- **WHEN** the user asks what reaches a line, and the program contains that
  number inside a string, a comment or a directive
- **THEN** those places are not reported

#### Scenario: A line nothing reaches

- **WHEN** the user asks what reaches a line no jump names
- **THEN** nothing is reported, rather than a nearby line's jumps

## ADDED Requirements

### Requirement: A variable can be renamed as the machine understands it

The server SHALL rename a variable throughout a program, changing exactly the
uses it reports as that variable's uses. A place the machine would read as a
different variable SHALL NOT be changed, and a place it would read as the same
variable SHALL NOT be left behind — including, on a machine that distinguishes
only the first few characters of a name, the other spellings that machine stores
as the same variable. Where such other spellings are changed, the user SHALL be
told that they were.

A name's type marker SHALL be preserved, so that a renamed variable stays the
kind of variable it was.

The server SHALL refuse a rename the machine would not survive, rather than
carrying it out and leaving the user to discover it by running the program. A
rename SHALL be refused where the new name is one the bound machine would read as
a keyword rather than as a name, and where the new name is one the machine would
store as a variable the program already has. A refusal SHALL say why, on the same
terms the machine's own reading of the program would say it.

Where a use is written so that the machine reads it as part of a longer run of
characters, the rename SHALL be refused rather than rewriting what surrounds it.

#### Scenario: Renaming a variable

- **WHEN** the user renames the variable under the cursor
- **THEN** every place the machine would read that same variable is changed, and
  nowhere else is

#### Scenario: Renaming keeps the kind of variable

- **WHEN** the user renames a variable written with a type marker
- **THEN** the renamed variable carries the same marker, and is still the kind of
  variable it was

#### Scenario: Two names the machine cannot tell apart

- **WHEN** the user renames a variable on a machine that distinguishes only the
  first few characters of a name, and another spelling in the program is stored
  as the same variable
- **THEN** that spelling is changed too, and the user is told it was

#### Scenario: A new name the machine would read as a keyword

- **WHEN** the user renames a variable to a name the bound machine reads as a
  keyword
- **THEN** the rename is refused and the reason is given, and the program is not
  changed

#### Scenario: A new name that collides with an existing variable

- **WHEN** the user renames a variable to a name the bound machine would store as
  a variable the program already has
- **THEN** the rename is refused and the reason is given, and the program is not
  changed

#### Scenario: A rename that leaves the program unreadable to the machine

- **WHEN** a rename would make the program one the bound machine reports a
  problem with that it did not report before
- **THEN** the rename is refused, and the reason given is the problem the machine
  reports

#### Scenario: Renaming what a procedure keeps to itself

- **WHEN** the user renames a variable a procedure declares as its own, on a
  machine that has procedures
- **THEN** only that procedure's uses are changed, and a variable of the same
  name outside it is left alone
