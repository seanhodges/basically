## ADDED Requirements

### Requirement: Variable names that collide on the target are reported

Machines differ in how much of a variable name they keep: some keep every
character, some keep the first two, some keep one. A program moving to a machine
that keeps fewer characters than it was written for can have two of its variables
silently become one — nothing fails to tokenize, nothing is reported by any
difference list, and the program computes the wrong answer.

Where the reader's own program is at hand, the comparison SHALL report the
variable names in that program that the target machine would treat as the same
variable, naming the names that collide and what the target reduces them to.
Names that remain distinct on the target SHALL NOT be reported.

Whether a name's type marker distinguishes it SHALL be decided as the target
machine decides it, so two names the target keeps apart are not reported as
colliding.

Where the target keeps at least as much of a name as the source, nothing SHALL be
reported. Where there is no program, nothing SHALL be reported: which names
collide is a fact about a program, not about a pair of machines.

#### Scenario: Two names the target cannot tell apart

- **WHEN** a user compares two machines with a program open that uses two variable
  names which the target machine reduces to the same name
- **THEN** the comparison reports both names together with what the target reduces
  them to

#### Scenario: Names that stay distinct

- **WHEN** the program's variable names remain distinct under the target machine's
  rule
- **THEN** nothing is reported about variable names

#### Scenario: Names distinguished by their type marker

- **WHEN** two of the program's names would collide but for a type marker the
  target machine treats as part of the name
- **THEN** they are not reported as colliding

#### Scenario: A target that keeps more of a name

- **WHEN** the target machine keeps at least as many characters of a name as the
  source machine does
- **THEN** nothing is reported about variable names

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the target's variable-naming rule is still reported among the language
  and hardware differences, and no collisions are reported

### Requirement: How colour attaches to the display is reported in the guidance

Machines attach colour to the display in incompatible ways — to each pixel, to
each character cell, or by screen mode — and the commands that draw are often
spelled the same on both. A routine ported between two such machines needs no
change to any command and looks wrong when it runs, so no list of commands can
carry this difference.

Where the target machine attaches colour to its display differently from the
source, the guidance SHALL say so, and SHALL say what it means for a program
being ported rather than only naming the model. Where the two machines attach
colour alike, or the target has no colour, nothing SHALL be added.

#### Scenario: Porting to a machine with per-cell colour

- **WHEN** the user compares a machine that colours each pixel against a target
  that colours each character cell
- **THEN** the guidance says so, and says what it means for a routine that draws in
  more than one colour

#### Scenario: Porting to a machine whose colour depends on the screen mode

- **WHEN** the target machine's available colours depend on the screen mode chosen
- **THEN** the guidance says so, and names the choice the port has to make

#### Scenario: Two machines with the same display model

- **WHEN** the two machines attach colour to the display the same way
- **THEN** nothing is added to the guidance about it

## MODIFIED Requirements

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each machine has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

Where the target machine has no fractions and the reader's own program is at hand, the comparison
SHALL additionally report whether that program performs arithmetic the target would truncate — a
division, or a fractional value — so that a reader is told which of their calculations must be
rescaled rather than only that the machine cannot hold fractions. Where the program performs no such
arithmetic, or the target has fractions, nothing SHALL be reported beyond the difference itself.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target machine that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

#### Scenario: A program that divides, ported to an integer-only machine

- **WHEN** the target machine has no fractions and the open program divides or carries a fractional
  value
- **THEN** the comparison reports that this arithmetic is truncated on the target and must be
  rescaled, naming the range the target holds

#### Scenario: A program with no fractional arithmetic

- **WHEN** the target machine has no fractions and the open program performs no division and carries
  no fractional value
- **THEN** the difference in number handling is still reported and nothing is reported about the
  program's arithmetic

#### Scenario: A target that has fractions

- **WHEN** the target machine has floating point
- **THEN** nothing is reported about the program's arithmetic being truncated
