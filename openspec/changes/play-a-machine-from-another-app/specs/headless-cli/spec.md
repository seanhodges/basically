## ADDED Requirements

### Requirement: A held machine can be played from the command line

The user SHALL be able to ask for the machine being held to be played, and SHALL
be given an address to open in a browser or to hand to an application that shows
a web page. Playing SHALL be an operation like any other, listed among the
operations and described among them, and SHALL be reported as having failed when
no address could be given.

The user SHALL be able to give the play channel up without letting the machine
go. Asking to play while a play channel is already open SHALL report the address
already in use rather than opening a second one.

Where the toolchain answering the request is not one that can project anything,
the user SHALL be told that rather than being given an address that leads
nowhere.

What the user is told about the address SHALL say that it is reachable from this
computer only, and that holding it is the whole of what admits whoever plays —
stated as acting on the machine rather than as watching it.

#### Scenario: Playing the held machine

- **WHEN** the user asks for the held machine to be played
- **THEN** an address is reported, and opening it shows the machine and types at
  it

#### Scenario: Asking with no machine held

- **WHEN** the user asks for a machine to be played while none is held
- **THEN** it is reported that no machine is being held and how to start one

#### Scenario: Giving the channel up

- **WHEN** the user gives up the play channel
- **THEN** the channel ends, the machine is still held, and later commands can
  act on it

### Requirement: The tool can serve the operations conversation over its own streams

One of the tool's operations SHALL serve the toolchain's own operations
conversation over its standard streams rather than doing a piece of work and
finishing, on the same terms as the operations that serve an editor and an
agent: it SHALL hold its streams open, serve the caller that started it, and end
when that caller disconnects or the user stops it. Asking what the tool can do
SHALL list it among the operations, and asking about it SHALL say how an
application is expected to start it.

A caller served this way SHALL hold a machine of its own, separate from the one
the command line holds between commands, so that an application embedding the
toolchain is neither given the user's machine nor able to disturb it.

Being told which machine a program is for SHALL work for this operation as it
does for the others — the caller MAY name one, and it stands as the default for
that caller's session — but naming no machine SHALL NOT be the caller's mistake
here, because a caller can say which machine it wants after the server has
started.

#### Scenario: Starting the operations conversation

- **WHEN** the user starts the operation that serves the operations conversation
- **THEN** the tool serves that caller over its standard streams and keeps
  running until the caller disconnects

#### Scenario: An embedding application's own machine

- **WHEN** an application served this way holds a machine, and the user runs a
  program from the command line holding a machine of their own
- **THEN** neither is given the other's machine, and neither is disturbed by it

#### Scenario: Starting it without naming a machine

- **WHEN** the user starts that operation and names no machine
- **THEN** the server starts, rather than being refused the way an operation on a
  program would be

## MODIFIED Requirements

### Requirement: The command line can hold a machine between commands

The command line SHALL be able to leave the machine a run booted still running
when the command that started it has ended, and a later command SHALL be able to
act on that machine. What one command does to the machine SHALL be what the next
command sees.

The user SHALL be able to say that a run is to leave its machine up, to ask which
machine is being held, and to let a held machine go. A machine SHALL be let go
when the user says so, and SHALL NOT be left running indefinitely with nothing
attending to it.

The machine SHALL advance only when a command asks it to, except while it is
being played, when it advances on its own clock on the terms `machine-play`
states. A command that acts on the machine SHALL spend the time it needs; a
command that only reads the machine SHALL spend none, so that reading the screen
never changes it. Every measurement SHALL be in the emulated machine's own time
and SHALL NOT vary with how long the user took between commands.

A command that needs a machine when none is being held SHALL say so and say how
to start one, rather than failing without explanation.

#### Scenario: Acting and then looking

- **WHEN** the user runs a program that waits at a prompt so that its machine is
  left up, presses a key in a later command, and reads the screen in a third
- **THEN** the screen read is the one that keypress left, not the one the program
  started at

#### Scenario: Reading without disturbing

- **WHEN** the user reads a held machine's screen twice with nothing in between
- **THEN** the same screen is reported both times

#### Scenario: A pause between commands

- **WHEN** a long time passes between two commands acting on a held machine
- **THEN** the machine is where the earlier command left it, and the run's
  measurements are the same as if the commands had come one after another

#### Scenario: A pause while the machine is being played

- **WHEN** a long time passes between two commands while the held machine is
  being played
- **THEN** the machine has gone on running, and this is the one case in which a
  held machine is not where the earlier command left it

#### Scenario: Letting a machine go

- **WHEN** the user asks for the held machine to be let go
- **THEN** it is let go, and a later command reports that no machine is being
  held

#### Scenario: Acting before a machine is up

- **WHEN** the user asks for something that needs a machine while none is held
- **THEN** it is reported that no machine is being held and how to start one
