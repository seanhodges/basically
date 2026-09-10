## MODIFIED Requirements

### Requirement: The toolchain can be served from a host that outlives one request

The toolchain outside the browser SHALL be able to run as a host that keeps
serving after it has answered, rather than only as a program that answers once
and ends. The host SHALL hold what is expensive to prepare — the toolchain
itself, the machines it knows about, and any machine a caller has asked it to
keep — so that a caller reaching an already-running host pays for none of it
again.

The host SHALL be reachable by the callers on the same computer that belong to
the same user, and SHALL NOT be reachable from another computer or by another
user. No caller SHALL have to name a network address, and none SHALL be asked to
present a secret of its own: whom the host will talk to SHALL be settled by the
operating system's own ownership of the channel.

A caller is anything that reaches the toolchain to have work done — the command
line, an editor, an agent. Something that only receives what the host projects to
it, holding no machine and reaching no operation, is not a caller, and this
requirement does not govern it. The only such projection the product offers is a
view of a held machine's display, whose reachability and admission are governed
by `display-view`; nothing else the host serves SHALL be reachable other than as
described here.

#### Scenario: A second command reaching a running host

- **WHEN** a command is given while a host is already running
- **THEN** it is answered by that host, without a second copy of the toolchain
  being prepared

#### Scenario: Reachable only by its owner

- **WHEN** the host is running
- **THEN** it is reachable by that user's callers on that computer, and by
  nothing else

#### Scenario: Something that only receives a projection

- **WHEN** something is shown a view the host projects, without holding a machine
  or reaching any operation
- **THEN** it is not a caller, and it is admitted on the terms `display-view`
  states rather than by the operating system's ownership of a channel

### Requirement: The host holds machines without letting one caller's machine be another's

A host SHALL be able to hold a machine for each caller that asks for one, and no
caller SHALL be given, or disturbed by, a machine another caller is holding. What
one caller does to its machine SHALL be invisible to every other.

Where the caller holding a machine has itself asked for that machine's display to
be projected, showing it is not an exception to that: a projection is made only
at the request of the caller whose machine it shows, is seen by no other caller,
and gives whoever sees it no way to act on the machine.

A machine SHALL be let go when the caller holding it releases it, disconnects, or
disappears without saying so, so that a caller that stops leaves nothing behind.
Any projection of that machine SHALL end with it.

#### Scenario: Two callers, two machines

- **WHEN** two callers each ask the host for a machine and each acts on its own
- **THEN** neither sees what the other did, and neither is refused because the
  other holds one

#### Scenario: A caller that disappears

- **WHEN** a caller holding a machine disconnects without releasing it
- **THEN** that machine is let go

#### Scenario: A machine its holder has asked to have projected

- **WHEN** a caller asks for its own machine's display to be projected
- **THEN** it is projected, no other caller is given or disturbed by that
  machine, and the projection ends when the machine is let go
