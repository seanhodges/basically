## ADDED Requirements

### Requirement: The program's line numbers are checked against the target's range

Machines differ in which line numbers a BASIC program may use, from a few thousand
to tens of thousands, and at both ends of the range: a machine whose lowest line
number is 1 will not accept a program that opens at line 0.

Where the reader's own program is at hand, the comparison SHALL report a line
number the target machine would not accept, naming the target's range and which
end of it the program falls outside. Where every line number the program uses lies
within the target's range, nothing SHALL be reported.

The comparison SHALL report the target's valid range of line numbers among the
language and hardware differences whether or not a program is open, as it does the
other language rules.

#### Scenario: A program numbered beyond the target's ceiling

- **WHEN** a user compares two machines with a program open whose highest line
  number is above the highest the target machine accepts
- **THEN** the comparison reports that the program must be renumbered, naming the
  target's range and the program's highest line number

#### Scenario: A program numbered below the target's floor

- **WHEN** the program uses a line number below the lowest the target machine
  accepts
- **THEN** the comparison reports it, naming the target's range

#### Scenario: A program whose numbers fit

- **WHEN** every line number the program uses lies within the target machine's
  range
- **THEN** nothing is reported about line numbers beyond the range itself among the
  language and hardware differences

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the target's range of line numbers is still reported among the language
  and hardware differences, and nothing is reported about a program's own numbers

## MODIFIED Requirements

### Requirement: How the program's statement layout must change is reported

Machines differ in whether several statements fit on one line and in what separates
them. Where the reader's own program is at hand, the comparison SHALL report how that
program's statement layout must change: which of its lines carry more than one
statement, and whether each such line must be split into several lines or merely
re-separated with the target's own separator.

Splitting is the one change a port makes that creates lines the program did not
have. Where the target takes one statement per line, the comparison SHALL therefore
report how many lines the program becomes, and SHALL report it as an overflow where
the target's range of line numbers cannot hold that many lines however they are
renumbered.

The program's lines SHALL be counted as the language being ported **from** reads them,
so a separator character used as ordinary text on the source machine is not mistaken
for a statement break.

Where the program has no line carrying more than one statement, or the two machines
separate statements alike, nothing SHALL be reported.

#### Scenario: Porting to a machine that takes one statement per line

- **WHEN** the program has lines carrying several statements and the target machine
  takes only one statement per line
- **THEN** the comparison reports how many of the program's lines must be split,
  which, and how many lines the program becomes

#### Scenario: Splitting overflows the target's line numbers

- **WHEN** splitting the program's multi-statement lines would produce more lines
  than the target machine's range of line numbers can hold
- **THEN** the comparison reports that the split cannot be renumbered to fit,
  naming the projected number of lines and the target's range

#### Scenario: Splitting that still fits

- **WHEN** splitting produces more lines than the program had, and the target
  machine's range of line numbers holds them
- **THEN** the projected number of lines is reported and no overflow is reported

#### Scenario: Porting to a machine that separates statements differently

- **WHEN** the program has lines carrying several statements and the target machine
  separates statements with a different character
- **THEN** the comparison reports which lines are affected and what the separator
  becomes, and reports no projected line count, the program's lines being unchanged
  in number

#### Scenario: A program with nothing to restructure

- **WHEN** every line of the program carries a single statement
- **THEN** nothing is reported about statement layout, whatever the two machines allow

#### Scenario: The separator as ordinary text

- **WHEN** the machine being ported from has no statement separator, and the program
  uses that character as ordinary text
- **THEN** those lines are not reported as carrying several statements
