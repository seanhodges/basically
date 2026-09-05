# mcp-server Specification

## Purpose

Serve the toolchain to an agent over the Model Context Protocol — every
operation the product offers outside the browser, reachable by a program that
speaks the protocol without anything written specifically for it. Unlike a call
that does a piece of work and finishes, the server holds a machine between
requests, so an agent can run a program, look at its screen, press a key and
look again, and is answered rather than cut off when it asks for something that
cannot be done.

## Requirements

### Requirement: The toolchain can be served to an agent over the protocol

The product SHALL be able to serve its toolchain to a program that speaks the
Model Context Protocol, without that program needing anything written
specifically for it. The server SHALL be started by the user or by the client,
SHALL exchange messages over its standard streams, and SHALL keep serving until
the client disconnects or asks it to stop. Asking what the tool can do SHALL
list it among the operations, and asking about it SHALL say how a client is
expected to start it.

Naming a machine when starting the server SHALL be allowed and SHALL stand as
the default for the session; naming none SHALL NOT be the caller's mistake here,
as it is for an operation on a program, because a client may say which machine
it wants after the server has started.

#### Scenario: Serving a client

- **WHEN** a client starts the server, announces itself, and asks what it offers
- **THEN** the server names every operation it can perform, and goes on
  answering requests until the client disconnects

#### Scenario: Starting a server without naming a machine

- **WHEN** the user starts the server and names no machine
- **THEN** the server starts, rather than being refused the way an operation on
  a program would be

### Requirement: Every operation the toolchain offers is offered here

Every operation the toolchain declares SHALL be reachable from this server.
Where one deliberately is not, that absence SHALL be declared together with its
reason, on the same terms as any other caller's, and SHALL stop being declared
once it stops being true.

An absence declared of another caller SHALL NOT be carried over here on that
caller's reason. Where an operation is withheld from a caller because of the
circumstances that caller works in, those circumstances SHALL be shown to hold
here before the same absence is declared here.

#### Scenario: An operation the toolchain gains

- **WHEN** an operation becomes available anywhere in the toolchain
- **THEN** it is reachable from this server, unless it is declared as one this
  server deliberately does not offer

#### Scenario: An operation another caller deliberately lacks

- **WHEN** an operation is declared absent from another caller
- **THEN** it is still offered here, unless the reason for that absence is shown
  to hold here too

### Requirement: A machine stays up between requests

Once a program has been run, the machine it ran on SHALL stay up and SHALL be
what later requests act on, until the client asks for another program or
disconnects. What one request does to the machine SHALL be what the next request
sees.

The machine SHALL advance only when a request asks it to. A request that acts on
the machine SHALL spend the time it needs; a request that only reads the machine
SHALL spend none, so that reading the screen never changes it. Every measurement
of a run SHALL be in the machine's own time, and SHALL NOT vary with how long
the client took between requests.

#### Scenario: Acting and then looking

- **WHEN** a client runs a program that waits at a prompt, acts on the machine,
  and then reads the screen
- **THEN** the screen it reads is the one its own action left, not the one the
  program started at

#### Scenario: A client that pauses

- **WHEN** a client waits a long time between two requests
- **THEN** the machine is where the earlier request left it, and the run's
  measurements are the same as if the requests had come one after another

#### Scenario: Reading without disturbing

- **WHEN** a client reads the screen twice with nothing in between
- **THEN** it reads the same screen both times

### Requirement: One machine is held at a time

The server SHALL hold at most one machine. Asked to run a program while a
machine is already up, it SHALL either replace the machine it holds or state
that it cannot, and SHALL do the same thing every time — never leaving two
machines up, and never appearing to succeed while acting on the older one.

When the client disconnects, any machine still up SHALL be let go, so that a
client that stops without saying so leaves nothing behind.

#### Scenario: Running a second program

- **WHEN** a client runs a program while a machine is already up
- **THEN** what became of the machine it was holding is stated, and only one
  machine is up afterwards

#### Scenario: A client that disappears

- **WHEN** a client disconnects while a machine is up
- **THEN** the machine is let go

### Requirement: A picture of the screen is served as a picture

Where a client can be shown an image, the display SHALL be served to it as an
image rather than as a description of one. A machine whose display cannot be
pictured SHALL say so rather than serving nothing.

#### Scenario: Asking for the screen as a picture

- **WHEN** a client asks for a picture of the display of a machine that is up
- **THEN** it is given the picture itself

#### Scenario: A machine that cannot be pictured

- **WHEN** a client asks for a picture that cannot be taken
- **THEN** it is told so, rather than being given nothing

### Requirement: A request that cannot be carried out is answered, not fatal

A request the server cannot carry out — one naming something it does not offer,
one whose input does not fit what that operation takes, or one needing a machine
before any is up — SHALL be answered saying what was wrong, and the server SHALL
go on serving. Such an answer SHALL be marked as a failure rather than passed
off as a result, and where a machine is what was missing the answer SHALL say
how to get one.

A request that is carried out but does not achieve what was asked SHALL likewise
be reported as a failure rather than as a success with disappointing contents.

#### Scenario: Asking for something not offered

- **WHEN** a client asks for an operation the server does not have
- **THEN** it is told so, the request is marked as failed, and the server goes
  on serving

#### Scenario: Acting before a machine is up

- **WHEN** a client asks for something that needs a machine before one is
  running
- **THEN** it is told that no machine is up and how to start one, rather than
  the request failing without explanation
