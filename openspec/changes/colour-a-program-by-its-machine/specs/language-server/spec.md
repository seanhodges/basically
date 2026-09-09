## ADDED Requirements

### Requirement: A program is coloured by the machine it is for

The server SHALL tell the editor what every run of characters in a program is —
a keyword, a function, an operator, a variable, a line number, a literal, a
comment, a directive — so that the editor can colour the listing with its own
theme rather than being handed colours. What is reported SHALL be the bound
machine's own reading of the program, the same reading the product's own editor
colours from, so that a name that is a keyword on one machine and an ordinary
variable on another is reported differently on each.

A keyword written in one of the short spellings the machine accepts SHALL be
reported as a keyword, and a run the machine's ROM would split into several
keywords SHALL be reported split the same way, so that what the editor colours
is what the machine would store rather than what a general-purpose reading of
BASIC would make of it.

The server SHALL be able to answer for part of a program as well as for all of
it, so that an editor showing one screen of a long listing need not ask about
the rest.

A program the server could not bind to a machine SHALL be reported as nothing,
rather than being classified as though some machine had been chosen.

#### Scenario: Colouring a program

- **WHEN** the editor asks what a program's text is made of
- **THEN** it is told, for every run of characters, which of those kinds it is,
  at its place in the program

#### Scenario: The same name on two machines

- **WHEN** the same listing is bound to a machine that has a given name as a
  keyword and to one that does not
- **THEN** that name is reported as a keyword on the first and as an ordinary
  variable on the second

#### Scenario: A short spelling

- **WHEN** a program contains a keyword written in a short spelling the bound
  machine accepts
- **THEN** it is reported as a keyword, over the characters the user wrote

#### Scenario: Part of a program

- **WHEN** the editor asks about one range of a program rather than all of it
- **THEN** it is told about that range, on the same terms as it would be told
  about the whole

#### Scenario: No machine, no colour

- **WHEN** the editor asks about a program the server could not bind to a
  machine
- **THEN** nothing is reported for it, and no kind is guessed at
