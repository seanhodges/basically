## ADDED Requirements

### Requirement: The editor is told which machine a program was bound to

The server SHALL report, for every program it has been asked about, which
machine it settled on, without the editor having to ask. The report SHALL be
made whenever the binding is established or changes — when a program is opened,
when its text changes, and when the configured machine changes and open programs
are reconsidered — so that an editor showing it is never showing a machine the
server has stopped using.

Where the server declined to bind a machine, it SHALL report that it declined,
distinguishably from a program it has not reported on at all. The point of this
is that an editor can tell the server's correct silence about an unbindable
program from its own failure to reach the server.

The report SHALL name the machine the same way it is named everywhere else in
the product, and SHALL say which of the precedence's answers it came from — what
the program declared, what the user configured, or what was inferred.

The report SHALL identify the program and the version of it that was bound, so
an editor can tell an answer about the text it holds from one about text it has
since replaced.

The server SHALL declare that it makes this report, so that an editor can
establish before receiving one whether this server sends them.

The report SHALL NOT restate the remedy for a program no machine could be
settled for. That sentence is already reported as a problem on the program and
SHALL remain the one place it is said.

#### Scenario: A program that declares its machine

- **WHEN** an editor opens a program declaring a machine
- **THEN** the server reports that machine, and that the program itself declared
  it, without the editor asking

#### Scenario: A program no machine could be settled for

- **WHEN** an editor opens a program that declares no machine, the user having
  configured none, whose text several registered machines read equally
- **THEN** the server reports that it declined to bind one, rather than
  reporting nothing

#### Scenario: The configured machine changes

- **WHEN** the user changes the configured machine while programs relying on it
  are open
- **THEN** the server reports the new machine for each of them, unasked

#### Scenario: An editor that ignores the report

- **WHEN** an editor that knows nothing of this report is connected
- **THEN** every other answer it receives is unchanged
