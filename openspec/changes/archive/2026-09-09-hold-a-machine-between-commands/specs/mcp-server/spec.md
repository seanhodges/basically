## ADDED Requirements

### Requirement: The agent's server may be served from a shared host

The server SHALL be reachable both as a program started for one client, speaking
the protocol over its standard streams, and as one of the conversations a shared
host serves. A client SHALL be offered the same operations and answered the same
way either way, and a client that starts the server itself SHALL need no change
and SHALL see no difference.

Where the server is served from a shared host, the machine it holds SHALL belong
to that client alone: no other caller of the host SHALL be given it or disturb
it, and it SHALL be let go when that client disconnects, exactly as it is when
the server is a program of its own.

#### Scenario: A client that starts the server itself

- **WHEN** a client starts the server and speaks the protocol over its standard
  streams
- **THEN** it is offered every operation and answered as it is today, whether or
  not a shared host is also running

#### Scenario: A client reaching a shared host

- **WHEN** a client reaches the server as a conversation of a shared host
- **THEN** it is offered the same operations and answered the same way as a
  client that started the server itself

#### Scenario: A machine that is not shared

- **WHEN** a client's machine is up on a shared host and another caller of that
  host acts on its own machine
- **THEN** neither client's machine is disturbed by the other, and each reads
  only what its own requests left
