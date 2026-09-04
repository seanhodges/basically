## MODIFIED Requirements

### Requirement: A program is named as a file, and a pipe still works

Every operation that reads a program SHALL take the path of a file holding it. A
path of `-`, or no path at all, SHALL mean the program arrives on standard input,
so a program can be piped in without being written to disk first. An operation on
a program SHALL name the machine it is for; naming no machine, or a machine that is
not registered, SHALL be reported as the caller's mistake.

Naming the machine SHALL NOT be required where the program itself declares one.
Naming one anyway SHALL be honoured and SHALL take precedence over the
declaration, so that a caller can deliberately read a program as a machine other
than the one it was written for. Naming a machine that is not registered SHALL
remain the caller's mistake whether or not the program declares one.

#### Scenario: Piping a program in

- **WHEN** the user pipes a listing to an operation and names a machine, without
  giving a file path
- **THEN** the operation reads the piped listing and works on it as if it had been
  named as a file

#### Scenario: A program that says what it is for

- **WHEN** the user checks or builds a program that declares its machine, naming
  no machine on the command line
- **THEN** the operation works on it as that machine's program, rather than being
  refused for naming no machine

#### Scenario: Overriding what the program says

- **WHEN** the user names a machine for a program that declares a different one
- **THEN** the operation reads it as the machine the user named
