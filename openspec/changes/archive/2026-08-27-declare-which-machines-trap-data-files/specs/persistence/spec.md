## ADDED Requirements

### Requirement: A machine that cannot capture a program's files says so

Not every machine intercepts the file I/O a running program performs. Whether a
machine does SHALL be a declared property of that machine, true of exactly those
whose emulation actually intercepts it.

Where a machine does not intercept, the IDE SHALL say so wherever a program's
captured files are presented, rather than presenting an emptiness that reads as a
program having saved nothing. The two cases SHALL be distinguishable: a machine
that captures files and has none yet is not the same as a machine that never
could.

A machine's declaration SHALL NOT be taken on trust. A machine that claims to
capture a program's files SHALL be held to it by running a program that saves one
and reads it back.

#### Scenario: A machine with no traps explains the empty list

- **WHEN** the user views a program's captured files on a machine whose emulation
  does not intercept file I/O
- **THEN** the IDE states that this machine does not capture the files a program
  saves

#### Scenario: A machine with traps and nothing saved yet shows an empty list

- **WHEN** the user views a program's captured files on a machine that does
  intercept file I/O, and the program has saved none
- **THEN** the IDE presents an empty list, and does not claim the machine is
  incapable

#### Scenario: A machine is held to what it claims

- **WHEN** a machine declares that it captures the files a program saves
- **THEN** a program run on that machine that saves a data file and loads it back
  receives exactly the data it saved
