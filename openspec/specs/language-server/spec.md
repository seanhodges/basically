# language-server Specification

## Purpose

Let a BASIC program be edited in any editor that speaks the Language Server
Protocol, not only the product's own — serving diagnostics, completion, hover,
jump-to-definition and structure for the bound machine's dialect, without an
emulator or that machine's ROM.
## Requirements
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
completion SHALL say which of these it is, so that an editor showing a kind
beside each one distinguishes a variable the program declared from a keyword the
machine has. A completion for a block construct SHALL insert the whole construct,
with the places the user must fill in offered in order. On a machine whose ROM
matches keywords greedily without needing spaces between them, a completion
accepted part way through such a run SHALL replace the part the user meant and
not the whole run — and where what the user meant differs between a keyword and a
variable, each completion SHALL replace what it was offered for.

#### Scenario: Completing a keyword

- **WHEN** the user begins typing a keyword
- **THEN** the editor offers that machine's keywords beginning that way, each with
  what it does, and offers no keyword that machine lacks

#### Scenario: Completing a block construct

- **WHEN** the user accepts a completion for a construct that spans several lines
- **THEN** the whole construct is inserted and the user is offered each place to
  fill in, in order

#### Scenario: Completing a variable in scope

- **WHEN** the user begins typing a name in a program that already uses variables
- **THEN** the editor offers the names in scope at that point, marked as
  variables, alongside the machine's own keywords

#### Scenario: A variable out of scope

- **WHEN** the program defines a procedure with names local to it, and the user
  is typing outside that procedure
- **THEN** those local names are not offered

#### Scenario: Inside a string

- **WHEN** the cursor is inside a string literal
- **THEN** no keyword completion is offered

#### Scenario: A variable name inside a string

- **WHEN** the cursor is inside a string literal in a program that uses variables
- **THEN** no variable is offered either

### Requirement: A keyword explains itself where it is written

The server SHALL explain the keyword, function or operator under the cursor where
the user is reading it: how it is written, and what it does on the bound machine.
A keyword written in one of the short spellings the machine accepts SHALL be
explained as the keyword it stands for. Where the product's reference has nothing
for a keyword the machine has, the server SHALL still explain it from what the
machine itself declares, rather than saying nothing.

Where the explanation comes from the product's reference, it SHALL offer a way to
read that entry in full, at the reference the bound machine reads from and opened
at the keyword being explained — so that a reader who wants more than the
explanation has somewhere to go without leaving what they were reading to search
for it. An explanation the reference has nothing behind SHALL offer no such way,
rather than one that would arrive nowhere.

#### Scenario: Reading a keyword

- **WHEN** the user rests the cursor on a keyword
- **THEN** the editor shows how it is written and what it does on that machine

#### Scenario: Reading a short spelling

- **WHEN** the user rests the cursor on a short spelling the machine accepts
- **THEN** the editor explains the keyword that spelling stands for, and offers
  the full entry for that keyword rather than for the spelling

#### Scenario: Reading on to the full entry

- **WHEN** the user rests the cursor on a keyword the product's reference covers
- **THEN** the explanation offers a way to open that keyword's entry in the
  reference for the machine the listing is for

#### Scenario: A keyword the reference does not cover

- **WHEN** the user rests the cursor on a keyword the machine has and the
  product's reference has no entry for
- **THEN** it is still explained from what the machine declares, and no way to
  read further is offered

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

### Requirement: Colour covers all of what was asked about

The colour the server reports for a program SHALL cover the whole of what the
editor asked about: all of the program when the editor asked about the program,
and all of a range when it asked about a range. A program's length SHALL NOT
change how much of it is reported — only how much there is to report.

The server SHALL NOT report colour for part of a program as though it were the
answer for all of it. Where the server cannot report the whole of what was asked
about, it SHALL decline rather than answer for a part, so that an editor is never
told that a run of characters has no kind when the server simply did not reach it.

This holds however busy the machine serving the editor is, and however many times
the same program is asked about: asking twice SHALL NOT produce a fuller answer
than asking once, because the first answer SHALL already be complete.

#### Scenario: A listing longer than one screen

- **WHEN** the editor asks about a program far longer than the few kilobytes an
  editor shows at once
- **THEN** every run of characters in it is reported, to its last line

#### Scenario: The same program asked about twice

- **WHEN** the editor asks about an unchanged program a second time
- **THEN** it is told exactly what it was told the first time, neither less nor
  more

#### Scenario: A range near the end of a long program

- **WHEN** the editor asks about a range at the end of a program far longer than
  one screen
- **THEN** that range is reported in full, on the same terms as a range at the
  start

#### Scenario: A machine under load

- **WHEN** the program is asked about while the machine serving the editor is
  busy with other work
- **THEN** the answer covers the same runs it would have covered on an idle
  machine

### Requirement: Serving an editor requires no ROM

The server SHALL give every answer without any machine's ROM being present, and
SHALL NOT start a machine to answer anything. A user with no ROMs SHALL get the
same help as a user with all of them.

#### Scenario: Serving with no ROMs present

- **WHEN** the user runs the server with no ROMs present and opens a program
- **THEN** problems, completion, explanation, jumping and structure are all
  answered, and nothing reports a missing ROM

### Requirement: The editor's server may be served from a shared host

The server SHALL be reachable both as a program the editor starts for itself,
speaking the protocol over its standard streams, and as one of the conversations
a shared host serves. An editor SHALL be offered the same capabilities and given
the same answers either way, and an editor configured to start the server itself
SHALL need no change and SHALL see no difference.

Serving an editor from a shared host SHALL continue to require no ROM and SHALL
continue to boot no machine, whatever else that host is doing at the time: an
editor's answers SHALL NOT depend on, nor be delayed by, a machine another caller
of the same host is running.

#### Scenario: An editor that starts the server itself

- **WHEN** an editor starts the server and speaks the protocol over its standard
  streams
- **THEN** it is served as it is today, whether or not a shared host is also
  running

#### Scenario: An editor reaching a shared host

- **WHEN** an editor reaches the server as a conversation of a shared host
- **THEN** it is offered the same capabilities and given the same answers as an
  editor that started the server itself

#### Scenario: An editor served beside a running machine

- **WHEN** an editor asks for help from a shared host while another caller of
  that host is running a machine
- **THEN** the editor is answered without waiting for that machine, and no ROM is
  required for it to be answered

