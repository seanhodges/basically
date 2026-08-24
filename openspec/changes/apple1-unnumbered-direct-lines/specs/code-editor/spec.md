## MODIFIED Requirements

### Requirement: Line-number management

The editor SHALL support automatic line numbering while typing and a
renumbering command that rewrites line numbers (and, where the dialect uses
them, line-number references) consistently.

Where the active dialect accepts lines without a line number, those lines SHALL
keep their text and their place: renumbering SHALL neither number them nor
reorder them among the numbered lines around them, and automatic numbering
SHALL NOT put a number on one. This SHALL NOT change what happens on a dialect
that requires a line number on every line, where an unnumbered line is still
given one.

#### Scenario: Renumber a program

- **WHEN** the user renumbers a program
- **THEN** lines are renumbered in even increments and remain in the same
  order, and the program still tokenizes cleanly

#### Scenario: Renumber around a line the dialect takes unnumbered

- **WHEN** the user renumbers a program that holds a line the active dialect
  accepts without a line number
- **THEN** that line is unchanged and still sits between the same lines it did
  before

#### Scenario: Typing on a line the dialect takes unnumbered

- **WHEN** automatic numbering is on and the user presses Enter on a line the
  active dialect accepts without a line number
- **THEN** that line keeps its text and is not given a number

#### Scenario: An unnumbered line on a machine that requires numbers

- **WHEN** automatic numbering is on and the user presses Enter on an unnumbered
  line with a dialect selected that requires a line number on every line
- **THEN** the line is numbered, as it was before
