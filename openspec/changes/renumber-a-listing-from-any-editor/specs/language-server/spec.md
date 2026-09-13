## ADDED Requirements

### Requirement: A program's line numbers can be tidied from the editor

The server SHALL offer the editor two ways to renumber the program it has open:
laying the whole program out on even increments, and changing one line's number.
It SHALL declare both, so an editor offers the user neither unless this server
can carry it out.

A renumbering SHALL be given to the editor as an edit to the program it already
has open, so that it joins the user's own editing history rather than arriving as
text the editor must decide what to do with. The server SHALL say where the
caller's cursor belongs in the renumbered program, since which line it was on can
only be worked out from the machine's own reading of the listing.

Every line-number reference SHALL follow the line it names, whichever spelling
the machine writes it in, and a number that is not a line reference SHALL NOT be
treated as one. A line the bound machine accepts without a line number, and an
opaque binary record, SHALL keep its text and its place; the references either of
them carries SHALL still follow.

Renumbering the whole program SHALL start at, and step by, the increment in
force, which the user MAY configure and which SHALL be ten where they have not.
Changing one line's number SHALL take the number asked for; where the line has no
number of its own, it SHALL be given one appropriate to where it sits.

Where a renumbering cannot be carried out, the server SHALL change nothing and
SHALL tell the user why, in terms of the program rather than of the request.
Where the program has been edited since the renumbering was asked for, the server
SHALL carry out nothing, rather than apply a result worked out from text the user
has moved on from.

#### Scenario: Renumbering a whole program

- **WHEN** the editor asks the server to renumber a program whose lines are
  unevenly numbered and which jumps between them
- **THEN** the program comes back laid out on even increments in the same order,
  every jump still names the line it named before, and the editor's own program
  is changed rather than a copy of it

#### Scenario: Changing one line's number

- **WHEN** the editor asks the server to give a numbered line a different number
- **THEN** that line takes the new number, the program is back in ascending
  order, and every reference to the old number now names the new one

#### Scenario: A line that has no number of its own

- **WHEN** the editor asks the server to renumber a line that carries no number,
  on a machine that requires one
- **THEN** the line is given a number that keeps it where it sits, and the lines
  around it still run in ascending order

#### Scenario: A number that is already taken

- **WHEN** the editor asks for a line to be given a number another line already
  has
- **THEN** the program is left exactly as it was, and the user is told that
  number is already in use

#### Scenario: A number the machine could not hold

- **WHEN** the editor asks for a line number outside the range the bound machine
  accepts
- **THEN** the program is left exactly as it was, and the user is told which
  numbers are allowed

#### Scenario: A program too long for the increment in force

- **WHEN** the editor asks the server to renumber a program with so many lines
  that the increment in force would carry the last one past the highest number
  the machine accepts
- **THEN** the program is left exactly as it was, and the user is told that a
  smaller increment is needed

#### Scenario: Renumbering around a line the machine takes unnumbered

- **WHEN** the editor asks the server to renumber a program that holds a line the
  bound machine accepts without a line number
- **THEN** that line is unchanged and still sits between the same lines it did
  before, while any line reference it carries names the renumbered line

#### Scenario: Renumbering around an opaque binary record

- **WHEN** the editor asks the server to renumber a program that holds an opaque
  binary line record
- **THEN** the record's own text is unchanged, whatever it happens to spell, and
  it keeps its place among the lines around it

#### Scenario: The program moved on before the renumbering arrived

- **WHEN** the program is edited after a renumbering is asked for and before the
  server carries it out
- **THEN** nothing is changed, and the user is told to ask again
