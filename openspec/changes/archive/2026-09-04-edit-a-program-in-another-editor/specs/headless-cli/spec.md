## ADDED Requirements

### Requirement: The tool can serve an editor instead of finishing

One of the tool's operations SHALL start a language server rather than do a piece
of work and finish: it SHALL hold its streams open, serve the editor that started
it, and end when that editor disconnects or the user stops it. Asking what the
tool can do SHALL list it among the operations, and asking about it SHALL say how
an editor is expected to start it.

Being told which machine a program is for SHALL work for this operation as it does
for the others — the caller MAY name one, and it stands as the default for the
editor's session — but naming no machine SHALL NOT be the caller's mistake here,
because an editor can say which machine it wants after the server has started.

#### Scenario: Starting a server

- **WHEN** the user starts the operation that serves an editor
- **THEN** the tool serves the editor over its standard streams and keeps running
  until the editor disconnects

#### Scenario: Starting a server without naming a machine

- **WHEN** the user starts that operation and names no machine
- **THEN** the server starts, rather than being refused the way an operation on a
  program would be

## MODIFIED Requirements

### Requirement: Output can be read by a program as well as a person

Every operation that reports something SHALL be able to report it as structured
data on request, carrying the same facts as the readable form and more where the
readable form summarises. Standard output SHALL carry only what was asked for — the
screen, the structured data, the problems found — so that it can be consumed
directly; every figure, timing, notice and progress remark SHALL go to standard
error.

An operation that serves rather than reports SHALL hold to the same rule from the
other end: its standard output belongs to the conversation it is having, so
nothing about how the work is going SHALL be written there either. What such an
operation has to say about itself SHALL go to standard error, or to whatever
reporting channel the thing it is serving provides.

#### Scenario: Consuming an operation's output

- **WHEN** a caller asks an operation for structured data and reads standard output
- **THEN** standard output holds only that data, and nothing the operation reports
  about how the work went is mixed into it

#### Scenario: An operation that serves rather than reports

- **WHEN** an operation that serves something is running and the tool has a notice
  to give
- **THEN** the notice does not appear on standard output, and what is being served
  is not disturbed by it

### Requirement: Exit codes separate the caller's mistake from the program's

An operation SHALL report success or failure through its exit code, and SHALL
distinguish three outcomes: it worked; the caller asked for something impossible —
an unknown machine, an unreadable file, an option that does not exist; or the BASIC
program itself is at fault. A caller SHALL be able to tell a bad invocation from a
bad program without reading any output.

An operation that serves until it is disconnected has no verdict on a program to
report, so this SHALL apply to it only as far as it can: asking for something
impossible when starting it SHALL still be the caller's mistake, and a server that
served and was disconnected SHALL report that it worked. No BASIC program's faults
SHALL be reported through the exit code of such an operation, because it reports
them to what it is serving instead.

#### Scenario: Checking a program that cannot run

- **WHEN** the user checks or builds a program that has a fatal problem
- **THEN** the operation fails with the outcome reserved for a program at fault,
  which is distinct from the one it uses for a bad invocation

#### Scenario: A server that is disconnected

- **WHEN** a server is started, serves an editor, and the editor disconnects
- **THEN** the tool reports that it worked, whatever problems the programs it
  served turned out to have

#### Scenario: A server that cannot be started

- **WHEN** the user starts a server naming a machine that is not registered
- **THEN** it fails with the outcome reserved for the caller's mistake, and no
  server is started
