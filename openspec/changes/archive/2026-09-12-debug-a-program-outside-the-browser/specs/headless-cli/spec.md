## ADDED Requirements

### Requirement: A held machine can be stopped, stepped and continued from the command line

The user SHALL be able to say which BASIC lines the held machine's program is to
stop before, to step a stopped program on to its next line, to continue it until
it stops again or ends, and to ask where it is. Each SHALL be an operation like
any other, listed among the operations and described among them.

A run SHALL be able to be told the lines to stop before, so that the user can
start a program that is going to stop rather than having to ask after it has
finished. A run that stopped SHALL report which line it stopped before, and the
machine SHALL be left there for the commands that follow.

Where the machine being held cannot be stepped, the user SHALL be told so and
told what can still be done with it, rather than being given a stop that never
happens.

#### Scenario: Running a program that stops, then looking at it

- **WHEN** the user runs a program telling it to stop before a line, and then
  reads the machine's variables in a later command
- **THEN** the run reports stopping before that line, and the variables read are
  the ones that line was reached with

#### Scenario: Stepping and continuing between commands

- **WHEN** the user steps a stopped program in one command and continues it in
  the next
- **THEN** each reports where the program then is, and the machine each command
  acts on is the one the previous command left

#### Scenario: Asking where the held machine is

- **WHEN** the user asks where the held machine is
- **THEN** the line a stopped program is stopped before, whether a program is
  running, the lines in force to stop on, and whether this machine can be stepped
  are all reported

#### Scenario: A machine that cannot be stepped

- **WHEN** the user asks a held machine that cannot be stepped to stop before a
  line
- **THEN** it is reported that this machine cannot be stepped and what can still
  be done with it

## MODIFIED Requirements

### Requirement: A machine can be described in full

The user SHALL be able to ask about one machine and receive what a person or a
program needs in order to write BASIC for it without opening the IDE: how much
memory a program may occupy, the rules that machine's BASIC imposes on the text of
a program, the keywords it understands, the formats it can be built to and
imported from, and whether it can be stepped a BASIC line at a time. The
description SHALL be derived from what the machine actually declares, never from a
list maintained beside it.

#### Scenario: Describing a machine

- **WHEN** the user asks about a registered machine
- **THEN** the reply states the program memory budget, the machine's BASIC rules,
  its keywords, the formats it builds to and imports from, and whether it can be
  stepped

#### Scenario: Asking whether a machine can be stepped

- **WHEN** the user asks about a machine that cannot say which BASIC line it is
  executing
- **THEN** the description says that machine cannot be stepped

### Requirement: Driving a machine requires its ROM

A run given a schedule SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken. A run told which lines to stop before SHALL be refused on the same terms
and for the same reason: without the ROM no BASIC line is ever executed, so the
stop the user asked for could never come. A run given neither a schedule nor a
line to stop before SHALL keep reporting a missing ROM as a condition of the run
rather than refusing.

Refusing SHALL say what the user can do about it, naming the ways a ROM is
obtained and agreed to, so the refusal is not a dead end.

#### Scenario: Driving without the ROM

- **WHEN** the user runs a program with a schedule on a machine whose ROM is not
  present
- **THEN** the run is refused as the caller's mistake, saying the ROM is missing
  and how one is obtained, and no action is carried out

#### Scenario: Asking for a stop without the ROM

- **WHEN** the user runs a program telling it to stop before a line, on a machine
  whose ROM is not present
- **THEN** the run is refused as the caller's mistake, saying the ROM is missing
  and how one is obtained, and no action is carried out
