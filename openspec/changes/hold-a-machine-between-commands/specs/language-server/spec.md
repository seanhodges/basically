## ADDED Requirements

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
