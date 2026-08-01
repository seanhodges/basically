## ADDED Requirements

### Requirement: The comparison names the BASIC each machine runs

The language and hardware differences SHALL name the BASIC each of the two
chosen machines runs, as its own version is named, and SHALL report it before
every other language or hardware difference.

The name SHALL be that of the machine chosen, not of the family it belongs to:
machines that share a reference for their BASIC do not always run the same
version of it, and that version is what a difference in the commands available
follows from. Two machines that genuinely run the same BASIC SHALL be named the
same, so a reader can tell a port between two BASICs from a port between two
versions of one.

#### Scenario: Two machines running different versions of one BASIC

- **WHEN** the user compares two machines of the same family whose BASIC
  versions differ
- **THEN** each is named with the version it runs, ahead of the other language
  and hardware differences

#### Scenario: Two machines running the same BASIC

- **WHEN** the user compares two machines that run the same BASIC
- **THEN** both are named with that same BASIC, and the comparison reports no
  difference in the BASIC they run

#### Scenario: The BASIC a machine runs is named consistently

- **WHEN** the user reads the name of a machine's BASIC while choosing it and
  again in the comparison
- **THEN** the two agree

### Requirement: The language and hardware differences are ordered by what the port turns on

The language and hardware differences SHALL be reported in a fixed order that
does not vary with the pair chosen, running from the differences that decide how
much of the program must change to those that affect only a program that reads
or writes memory directly.

The differences that describe memory — how memory is written, how an address is
written, and the addresses themselves — SHALL be reported together as one run
rather than interleaved with the language rules, and the addresses SHALL be
adjacent within it, so a reader needing them finds them in one place and a
reader who does not passes them in one step.

#### Scenario: Reading the differences top to bottom

- **WHEN** the user reads the language and hardware differences from the top
- **THEN** the BASIC each machine runs, how it handles numbers, and how much
  program memory it has are reached before the rules that affect only how
  individual statements are written

#### Scenario: Finding the memory addresses

- **WHEN** the comparison reports the machines' memory addresses
- **THEN** they are reported next to each other, within one run of the
  memory-related differences, rather than separated by unrelated rows

#### Scenario: The order does not depend on the pair

- **WHEN** the user changes which machines are compared
- **THEN** the differences that are reported appear in the same relative order
  as before
