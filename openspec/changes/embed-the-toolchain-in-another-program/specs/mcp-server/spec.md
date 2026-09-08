## MODIFIED Requirements

### Requirement: The toolchain can be served to an agent over the protocol

The product SHALL be able to serve its toolchain to a program that speaks the
Model Context Protocol, without that program needing anything written
specifically for it. The server SHALL be one a program can start, SHALL exchange
messages over the streams that program supplies, and SHALL keep serving until the
client disconnects or asks it to stop.

The server SHALL take the streams it speaks over from whoever starts it, and SHALL
NOT read them from the process it happens to be running in, so that what serves an
agent is a decision of the program that started it.

Naming a machine when starting the server SHALL be allowed and SHALL stand as
the default for the session; naming none SHALL NOT be the caller's mistake here,
as it is for an operation on a program, because a client may say which machine
it wants after the server has started.

#### Scenario: Serving a client

- **WHEN** a program starts the server on streams it supplies, and a client
  announces itself over them and asks what it offers
- **THEN** the server names every operation it can perform, and goes on
  answering requests until the client disconnects

#### Scenario: Starting a server without naming a machine

- **WHEN** the server is started and no machine is named
- **THEN** the server starts, rather than being refused the way an operation on
  a program would be

#### Scenario: Serving over streams that are not the process's own

- **WHEN** a program starts the server on a pair of streams of its own making
- **THEN** the conversation is carried over those streams, and nothing about the
  process the server is running in changes what is served
