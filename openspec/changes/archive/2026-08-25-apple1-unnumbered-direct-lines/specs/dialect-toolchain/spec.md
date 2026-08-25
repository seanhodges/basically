## ADDED Requirements

### Requirement: Lines a machine takes without a line number

Where a machine's own BASIC takes a command typed without a line number, and
its listings are written that way, the dialect's toolchain SHALL accept such a
line in the program text rather than reporting it as a line missing its number.
Which words may stand on an unnumbered line SHALL be exactly the ones that
machine takes that way; every other unnumbered line SHALL still be reported as
missing its line number, at that line.

An unnumbered line SHALL be accepted wherever it appears in the program, since
listings put them both before the program and after it. Unnumbered lines SHALL
contribute no program bytes and SHALL take no part in the ascending order the
numbered lines are held to.

A word accepted on an unnumbered line SHALL still be refused inside a numbered
line wherever the machine refuses it there, so that what the toolchain accepts
in each position is what the machine accepts.

Where an unnumbered line is malformed - an argument missing, out of range, or
contradicting an earlier one - the toolchain SHALL report it at its line and
column like any other error, rather than dropping the line or ignoring it.

Dialects whose machines require a line number on every line SHALL be unaffected,
and SHALL continue to report a missing line number for any unnumbered line.

#### Scenario: A listing that opens with unnumbered commands

- **WHEN** the user opens a program whose first lines hold that machine's
  unnumbered commands, followed by numbered program lines
- **THEN** the program tokenizes without error and runs

#### Scenario: An unnumbered command after the program

- **WHEN** a program ends with one of those commands on an unnumbered line
- **THEN** it is accepted, and the numbered lines above it are unaffected

#### Scenario: An unnumbered line that is not one of them

- **WHEN** an unnumbered line holds a statement the machine would only take
  inside a numbered line
- **THEN** an error identifies that line as missing its line number

#### Scenario: The same word inside a numbered line

- **WHEN** one of those commands is written inside a numbered line on a machine
  that refuses it there
- **THEN** an error identifies its line and column, as it did before

#### Scenario: A malformed unnumbered line

- **WHEN** an unnumbered command is given an argument the machine would reject
- **THEN** an error identifies that line and column, and the rest of the program
  is still processed

#### Scenario: A machine that requires line numbers

- **WHEN** the same unnumbered text is written with a machine selected whose
  BASIC requires a line number on every line
- **THEN** an error identifies that line as missing its line number

### Requirement: A declared workspace survives export and import

Where a program declares the bounds of its workspace, exporting it SHALL record
those bounds with it, and importing that image SHALL recover source that
declares them again - so that re-tokenizing what was imported rebuilds the same
workspace rather than the machine's default.

Where the user must address the machine's own memory by hand to load or save an
exported program, the instructions shown SHALL name the range that program
actually occupies, rather than the range a program that took the default would.

#### Scenario: A declared workspace round-trips

- **WHEN** the user exports a program that declares its own workspace and
  imports the result
- **THEN** the recovered source declares the same workspace, and re-tokenizing
  it reproduces the same image

#### Scenario: Transfer instructions follow the program

- **WHEN** the user is shown how to load a program that declared its own
  workspace onto real hardware
- **THEN** the memory range named is the one that program occupies

### Requirement: A workspace the program declares is honoured

Where a machine's BASIC lets a program declare the bounds of the memory its
program and variables share, and the dialect accepts that declaration in the
program text, the declared bounds SHALL be carried into the loadable image, so
that running the program gives it the workspace it asked for rather than the
machine's default.

The program's size SHALL be budgeted against the declared workspace, so that a
program is reported as too large only when it does not fit the workspace it
asked for. Bounds the machine could not hold - inverted, or outside its fitted
memory - SHALL be reported as errors at their line and column, and SHALL not be
carried into an image. Where the same bound is declared more than once, the last
declaration SHALL be the one that takes effect.

An unnumbered command that cannot change what is built SHALL be accepted and
preserved without comment. Reporting each one would be worse than silence: the
run gate refuses a program with any error against it, fatal or not, so a listing
would stop being runnable because it ends the way listings end. What each command
does on an unnumbered line SHALL instead be stated in the machine's language
reference.

#### Scenario: A program asks for a larger workspace

- **WHEN** the user runs a program that declares bounds giving it more room than
  the machine's default
- **THEN** the program runs with that larger workspace, and its size is measured
  against it

#### Scenario: A program too large for the workspace it asked for

- **WHEN** a program declares a workspace smaller than the program itself needs
- **THEN** the user is told the program does not fit the workspace it asked for

#### Scenario: Bounds the machine cannot hold

- **WHEN** a program declares bounds outside the machine's fitted memory, or a
  lower bound above its upper bound
- **THEN** an error identifies that line and column

#### Scenario: A command with nothing to change

- **WHEN** a program holds an unnumbered command that cannot affect a stored
  program
- **THEN** the line is kept as it stands and the program still builds and runs,
  with nothing reported against it
