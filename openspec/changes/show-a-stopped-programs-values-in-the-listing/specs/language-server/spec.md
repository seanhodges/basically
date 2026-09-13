## ADDED Requirements

### Requirement: A program's variables are locatable where they are written

The server SHALL report, for a part of a program an editor asks about, where each
of that program's variables is written, so that an editor holding a stopped
machine can show what each one holds beside the name it belongs to. The server
SHALL report where and under what name only; it SHALL NOT report what a variable
holds, and SHALL NOT require a machine in order to answer.

Each place reported SHALL carry the name the bound machine would answer to rather
than the spelling in the listing, so that a value can be found on a machine that
stores only part of a name. Each SHALL say whether the name is to be matched with
case or without, following the bound machine's own rule.

What counts as a variable SHALL be the bound machine's reading of the program —
the same reading that decides which spellings are one variable — and a name
appearing as a keyword, inside a string or inside a comment SHALL NOT be
reported. An array SHALL be reported under the name the machine holds it as.

Where the bound machine cannot report what its variables hold, the user SHALL be
told that this machine cannot report them, rather than being shown a listing with
no values and no reason.

A program the server could not bind to a machine SHALL have nothing reported for
it, as it has for every other question.

#### Scenario: Showing what a stopped program holds

- **WHEN** a program is stopped on a line and the editor asks where the variables
  in the part it is showing are written
- **THEN** each variable's place is reported, and the editor can show what each
  one holds beside it

#### Scenario: A machine that stores only part of a name

- **WHEN** the editor asks about a listing on a machine that keeps only the first
  few characters of a name
- **THEN** each place is reported under the name that machine holds, not the
  longer name written in the listing

#### Scenario: A machine that tells case apart

- **WHEN** the editor asks about a listing on a machine that distinguishes a
  name's case
- **THEN** the report says the name is to be matched with case, and on a machine
  that folds case it says it is to be matched without

#### Scenario: A name that is not a variable

- **WHEN** the editor asks about a part of a listing containing a keyword, a
  string and a comment that each read like a variable name
- **THEN** none of them is reported

#### Scenario: An array

- **WHEN** the editor asks about a part of a listing where an array element is
  written with an index
- **THEN** the place is reported under the name the machine holds the array as

#### Scenario: A machine that cannot say what it holds

- **WHEN** a program is stopped on a machine that cannot report what its
  variables hold
- **THEN** the user is told that this machine cannot report them

#### Scenario: A program with no machine settled

- **WHEN** the editor asks about a program the server declined to bind to a
  machine
- **THEN** nothing is reported for it
