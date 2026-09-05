## ADDED Requirements

### Requirement: A program can be edited in any editor that speaks the protocol

The product SHALL be able to serve a BASIC program's language help to an editor
other than its own, over the Language Server Protocol, without that editor
needing anything written specifically for it. The server SHALL be started by the
user or their editor, SHALL exchange messages over its standard streams, and
SHALL keep serving until the editor disconnects or asks it to stop. It SHALL
declare to the editor only the help it can actually give, so that an editor
offers the user nothing the server will decline.

While a server is running, its standard output SHALL carry the conversation with
the editor and nothing else; anything the server has to say about itself SHALL
reach the user through the protocol's own reporting or standard error.

#### Scenario: Serving an editor

- **WHEN** an editor starts the server, announces itself, and opens a BASIC
  program
- **THEN** the server announces what help it can give, accepts the program, and
  goes on answering questions about it until the editor disconnects

#### Scenario: The program changes as it is typed

- **WHEN** the editor reports edits to a program it has open
- **THEN** every later answer is about the program as edited, and the user is not
  required to save the file first

### Requirement: An editor is told which machine a program is for

The server SHALL determine which machine a program is for before answering
anything about it, and SHALL take the most specific answer available: what the
program itself declares, failing that what the user has configured, and failing
that what the program can be inferred to be. A machine SHALL be nameable the same
way it is everywhere else in the product. Inference SHALL decline to choose when
the program does not distinguish one machine from another, rather than picking
among the machines that read it equally.

Where no machine can be determined, the server SHALL say so in a way the user
will see in the editor, naming what to set, rather than answering as though some
machine had been chosen or staying silent. When the user changes which machine is
chosen, every open program SHALL be reconsidered against the new one without the
user reopening it.

#### Scenario: The user has named a machine

- **WHEN** the user has configured a machine and opens a program that declares
  none
- **THEN** every answer about that program is that machine's answer

#### Scenario: The program names its own machine

- **WHEN** the user opens a program that declares a machine, having configured a
  different one
- **THEN** every answer about that program is the declared machine's answer, so
  that programs for several machines can sit in one project

#### Scenario: Inference declines

- **WHEN** the user has configured no machine and opens a program that several
  registered machines would read equally well
- **THEN** the server declines to choose, and tells the user in the editor what
  to set, rather than picking one

#### Scenario: Changing the machine

- **WHEN** the user changes the configured machine while programs are open
- **THEN** the problems reported for every open program are those of the new
  machine

### Requirement: Problems appear as the editor's own diagnostics

The server SHALL report a program's problems to the editor as the editor's own
diagnostics, positioned at the line and column the problem is at, without the
user asking for a check. The problems reported SHALL be the same ones the product
reports for that program elsewhere.

A problem that prevents the machine storing the line SHALL be distinguished from
one the machine would store and that matters only when the line runs, so that an
editor can show them differently and the user can tell which is which.

#### Scenario: A problem while typing

- **WHEN** the user types a line the machine cannot store
- **THEN** the editor shows a problem at that line and column without the user
  asking for a check

#### Scenario: Two kinds of problem

- **WHEN** a program contains both a problem that prevents the machine storing a
  line and one that only matters when the line runs
- **THEN** the two are reported at different severities, and the second does not
  claim the program cannot be stored

### Requirement: Completion offers what the machine understands

The server SHALL offer completions drawn from the bound machine's own keywords,
the block constructs that machine has, and the variables the program has in scope
at that point. It SHALL offer nothing the machine does not have, and SHALL NOT
offer completions inside a string literal.

A completion SHALL carry what the product knows about it — how the keyword is
written and what it does — so that the editor can show it beside the name. A
completion for a block construct SHALL insert the whole construct, with the
places the user must fill in offered in order. On a machine whose ROM matches
keywords greedily without needing spaces between them, a completion accepted part
way through such a run SHALL replace the part the user meant and not the whole
run.

#### Scenario: Completing a keyword

- **WHEN** the user begins typing a keyword
- **THEN** the editor offers that machine's keywords beginning that way, each with
  what it does, and offers no keyword that machine lacks

#### Scenario: Completing a block construct

- **WHEN** the user accepts a completion for a construct that spans several lines
- **THEN** the whole construct is inserted and the user is offered each place to
  fill in, in order

#### Scenario: Inside a string

- **WHEN** the cursor is inside a string literal
- **THEN** no keyword completion is offered

### Requirement: A keyword explains itself where it is written

The server SHALL explain the keyword, function or operator under the cursor where
the user is reading it: how it is written, and what it does on the bound machine.
A keyword written in one of the short spellings the machine accepts SHALL be
explained as the keyword it stands for. Where the product's reference has nothing
for a keyword the machine has, the server SHALL still explain it from what the
machine itself declares, rather than saying nothing.

#### Scenario: Reading a keyword

- **WHEN** the user rests the cursor on a keyword
- **THEN** the editor shows how it is written and what it does on that machine

#### Scenario: Reading a short spelling

- **WHEN** the user rests the cursor on a short spelling the machine accepts
- **THEN** the editor explains the keyword that spelling stands for

### Requirement: A jump target can be reached from where it is named

The server SHALL take the user from where a destination is named to where it is
defined: from a line number written as a jump or a reference to that line, and
from a named procedure or function to where it is defined. A line number that no
line in the program has SHALL take the user nowhere rather than somewhere near.
A number that is not a line reference SHALL NOT be treated as one.

#### Scenario: Jumping to a line

- **WHEN** the user asks to go to the definition at a line number written as a
  jump
- **THEN** the editor moves to the line bearing that number

#### Scenario: Jumping to a procedure

- **WHEN** the user asks to go to the definition at a named procedure call on a
  machine that has procedures
- **THEN** the editor moves to where that procedure is defined

#### Scenario: A destination that is not there

- **WHEN** the user asks to go to the definition at a line number no line has
- **THEN** the editor moves nowhere, and does not offer a nearby line instead

### Requirement: A program's structure and a variable's uses are reachable

The server SHALL describe the program's structure to the editor — its procedures,
functions and the lines that are jumped to — so that the editor can list them and
the user can move between them. What is described SHALL be appropriate to the
bound machine, and SHALL NOT name a kind of structure that machine does not have.

The server SHALL also report every use of the variable under the cursor. Which
uses count SHALL follow the machine's own rules for what makes two names the same
variable and what makes them different, and a name appearing as a keyword, inside
a string or inside a comment SHALL NOT count as a use.

#### Scenario: Listing the structure

- **WHEN** the editor asks for the program's structure
- **THEN** it receives the procedures, functions and jumped-to lines that machine
  has, each at its place in the program

#### Scenario: Finding a variable's uses

- **WHEN** the user asks for the uses of the variable under the cursor
- **THEN** every place the machine would read that same variable is reported, and
  places where the name appears as a keyword, in a string or in a comment are not

#### Scenario: Two names the machine cannot tell apart

- **WHEN** the user asks for the uses of a variable on a machine that
  distinguishes only the first few characters of a name
- **THEN** the uses reported include the other names that machine stores as the
  same variable

### Requirement: Serving an editor requires no ROM

The server SHALL give every answer without any machine's ROM being present, and
SHALL NOT start a machine to answer anything. A user with no ROMs SHALL get the
same help as a user with all of them.

#### Scenario: Serving with no ROMs present

- **WHEN** the user runs the server with no ROMs present and opens a program
- **THEN** problems, completion, explanation, jumping and structure are all
  answered, and nothing reports a missing ROM
