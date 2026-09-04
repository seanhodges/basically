## ADDED Requirements

### Requirement: The command line is named for the product and organised by operation

The toolchain SHALL be reachable outside the browser under the product's own name
rather than the name of one of its jobs, and SHALL organise its work as named
operations, each doing one thing and each describing itself. Asking for help with
no operation named SHALL list the operations; naming an operation that does not
exist SHALL say so rather than guess at one.

#### Scenario: Asking what the tool can do

- **WHEN** the user invokes the command line with no operation, or asks it for help
- **THEN** it names every operation it offers and what each is for

### Requirement: A program is named as a file, and a pipe still works

Every operation that reads a program SHALL take the path of a file holding it. A
path of `-`, or no path at all, SHALL mean the program arrives on standard input,
so a program can be piped in without being written to disk first. An operation on
a program SHALL name the machine it is for; naming no machine, or a machine that is
not registered, SHALL be reported as the caller's mistake.

#### Scenario: Piping a program in

- **WHEN** the user pipes a listing to an operation and names a machine, without
  giving a file path
- **THEN** the operation reads the piped listing and works on it as if it had been
  named as a file

### Requirement: Every registered machine can be listed

The user SHALL be able to ask which machines are available and receive every
registered machine, each with the name and short description the product uses for
it elsewhere, and whether the machine's ROM is present — so that a caller can tell
what it is able to run before trying to run it.

#### Scenario: Listing the machines

- **WHEN** the user asks for the available machines
- **THEN** every registered machine is reported with its identifier, its name, its
  description, and whether its ROM is present

### Requirement: A machine can be described in full

The user SHALL be able to ask about one machine and receive what a person or a
program needs in order to write BASIC for it without opening the IDE: how much
memory a program may occupy, the rules that machine's BASIC imposes on the text of
a program, the keywords it understands, and the formats it can be built to and
imported from. The description SHALL be derived from what the machine actually
declares, never from a list maintained beside it.

#### Scenario: Describing a machine

- **WHEN** the user asks about a registered machine
- **THEN** the reply states the program memory budget, the machine's BASIC rules,
  its keywords, and the formats it builds to and imports from

### Requirement: A program can be checked without running it

The user SHALL be able to have a program checked for problems without an emulator
being booted and without any ROM being required, and SHALL receive every problem
found, each placed at the line and column it occurs on and marked as either fatal —
the program cannot be built or run — or advisory. Advisory problems alone SHALL NOT
make the check fail.

#### Scenario: Checking a program with an advisory problem only

- **WHEN** the user checks a program whose only problems are advisory
- **THEN** the problems are reported, and the check succeeds

### Requirement: A program can be built into a file the machine loads

The user SHALL be able to turn a program into the transfer format its machine
really loads, and to say where the result is written. The format SHALL be chosen by
the caller naming it, or inferred from the name of the file being written, and
SHALL fall back to the machine's usual format when neither settles it. Where a
format is more than one file, every file produced SHALL be written and every path
written SHALL be reported. A program with a fatal problem SHALL NOT be built.

#### Scenario: Building to a named file

- **WHEN** the user builds a program for a machine, naming an output file whose
  extension belongs to one of that machine's formats
- **THEN** the program is written in that format, and every path written is
  reported

### Requirement: A program can be run and its screen reported

The user SHALL be able to run a program on its machine and receive what the screen
shows, as text, as a picture, or as both in one run. The user SHALL be able to say
how many frames to run, or to let the run end when the program does, with a cap on
the wait. Where the run's ROM is missing, that SHALL be reported as a condition of
the run rather than ending it.

#### Scenario: Asking for the screen both ways

- **WHEN** the user runs a program asking for both the screen's text and a picture
  of it
- **THEN** the picture is written where the user asked and the screen's text is
  reported, from the same run

### Requirement: Output can be read by a program as well as a person

Every operation that reports something SHALL be able to report it as structured
data on request, carrying the same facts as the readable form and more where the
readable form summarises. Standard output SHALL carry only what was asked for — the
screen, the structured data, the problems found — so that it can be consumed
directly; every figure, timing, notice and progress remark SHALL go to standard
error.

#### Scenario: Consuming an operation's output

- **WHEN** a caller asks an operation for structured data and reads standard output
- **THEN** standard output holds only that data, and nothing the operation reports
  about how the work went is mixed into it

### Requirement: Exit codes separate the caller's mistake from the program's

An operation SHALL report success or failure through its exit code, and SHALL
distinguish three outcomes: it worked; the caller asked for something impossible —
an unknown machine, an unreadable file, an option that does not exist; or the BASIC
program itself is at fault. A caller SHALL be able to tell a bad invocation from a
bad program without reading any output.

#### Scenario: Checking a program that cannot run

- **WHEN** the user checks or builds a program that has a fatal problem
- **THEN** the operation fails with the outcome reserved for a program at fault,
  which is distinct from the one it uses for a bad invocation

### Requirement: Only running a machine requires its ROM

Describing machines, describing one machine, checking a program and building a
program SHALL all work without any ROM being present, so that an installation
carrying no ROMs is still useful for everything but running. Running a machine
SHALL let the user say where ROMs are read from, rather than only ever reading them
from where the product was installed.

#### Scenario: Working without ROMs

- **WHEN** the user lists machines, describes one, checks a program or builds a
  program on an installation with no ROMs present
- **THEN** each operation succeeds, and reports no ROM as missing because none was
  needed
