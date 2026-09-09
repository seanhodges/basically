## ADDED Requirements

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

#### Scenario: A second command reaching a running host

- **WHEN** a command is given while a host is already running
- **THEN** it is answered by that host, without a second copy of the toolchain
  being prepared

#### Scenario: Reachable only by its owner

- **WHEN** the host is running
- **THEN** it is reachable by that user's callers on that computer, and by
  nothing else

### Requirement: A host may serve any of the conversations, or all of them

The host SHALL be able to serve the command line's operations, an editor's
language server and an agent's protocol, and SHALL be told when it is started
which of them it is to serve — any one, any combination, or all. A caller asking
for a conversation the host was not started to serve SHALL be told so, and told
which it does serve, rather than being left waiting or answered wrongly.

Every conversation SHALL mean the same thing and give the same answers whether it
is served from a shared host or from a program started for that one caller.

#### Scenario: Serving everything

- **WHEN** a host is started without being told which conversations to serve
- **THEN** it serves all of them

#### Scenario: Serving one

- **WHEN** a host is started to serve only one of the conversations, and a caller
  asks for another
- **THEN** the caller is told that conversation is not served here, and which
  ones are

#### Scenario: The same answers either way

- **WHEN** the same request is made of a shared host and of a program started for
  that one caller
- **THEN** the answer is the same

### Requirement: Starting the toolchain for one caller keeps working

A caller SHALL still be able to start the toolchain as a program of its own,
speaking one conversation over its standard streams for as long as that caller is
connected, exactly as it does when there is no host. An editor or an agent
configured to start the toolchain this way SHALL need no change, and SHALL see no
difference in what it is offered or how it is answered.

#### Scenario: An editor that starts the toolchain itself

- **WHEN** an editor starts the toolchain to speak its protocol over standard
  streams
- **THEN** it is served for as long as it is connected, as it is today, whether
  or not a shared host is also running

### Requirement: A caller finds a host, or starts one

A caller SHALL find a host that is already running and use it. Finding none, it
SHALL start one and use that, without the user having asked for a host or having
to know whether one was running. Two callers starting at once SHALL end with one
host serving both, never with two hosts or with one caller failing because the
other won.

A host that has stopped SHALL NOT prevent a caller from starting a new one: the
remains of a stopped host SHALL be recognised as remains and cleared, rather than
being mistaken for a host that is running.

Where a caller can neither reach a host nor start one, it SHALL say so plainly,
saying what it tried, rather than waiting indefinitely or reporting the failure
as though the request itself were at fault.

#### Scenario: The first command

- **WHEN** a command is given and no host is running
- **THEN** a host is started and the command is answered, without the user having
  been asked

#### Scenario: Two commands at once

- **WHEN** two commands are given at the same moment and no host is running
- **THEN** one host ends up serving both, and neither command fails on account of
  the other

#### Scenario: The remains of a stopped host

- **WHEN** a command is given and a stopped host has left its channel behind
- **THEN** the remains are recognised and cleared, a new host is started, and the
  command is answered

#### Scenario: A host that cannot be started

- **WHEN** a caller can neither reach a host nor start one
- **THEN** it says so and says what it tried, rather than waiting indefinitely

### Requirement: A caller never reaches a host built from different source

A host SHALL be found by the user it belongs to and by the version of the
toolchain it was built from, so that a caller reaching a host is reaching one
that answers as that caller expects. A host built from different source SHALL be
invisible to a caller rather than reachable and wrong.

#### Scenario: A newer toolchain beside an older host

- **WHEN** a command from one version of the toolchain is given while a host
  built from a different version is running
- **THEN** the command does not reach that host, and is answered by one that
  matches it

### Requirement: A host can be stopped, and lets itself go when unwanted

The user SHALL be able to stop a running host with a command, and SHALL be told
whether one was running to stop. Stopping a host SHALL let go of any machine it
was holding, so that nothing is left running behind it.

A host SHALL also let itself go when nothing has needed it for a while, so that
starting one does not leave a process running for the rest of the user's session
without being asked for. A host SHALL NOT stop while a caller is still connected
to it.

#### Scenario: Stopping a host

- **WHEN** the user asks for the running host to be stopped
- **THEN** it stops, any machine it held is let go, and the user is told it was
  stopped

#### Scenario: Stopping when none is running

- **WHEN** the user asks for the host to be stopped and none is running
- **THEN** the user is told there was none, and this is not reported as a failure

#### Scenario: A host nobody is using

- **WHEN** nothing has asked anything of a host for a while and no caller is
  connected
- **THEN** it lets itself go

#### Scenario: A host that is in use

- **WHEN** a caller is connected to a host
- **THEN** the host does not let itself go while that caller is connected

### Requirement: The host holds machines without letting one caller's machine be another's

A host SHALL be able to hold a machine for each caller that asks for one, and no
caller SHALL be given, or disturbed by, a machine another caller is holding. What
one caller does to its machine SHALL be invisible to every other.

A machine SHALL be let go when the caller holding it releases it, disconnects, or
disappears without saying so, so that a caller that stops leaves nothing behind.

#### Scenario: Two callers, two machines

- **WHEN** two callers each ask the host for a machine and each acts on its own
- **THEN** neither sees what the other did, and neither is refused because the
  other holds one

#### Scenario: A caller that disappears

- **WHEN** a caller holding a machine disconnects without releasing it
- **THEN** that machine is let go

### Requirement: The host is answerable about itself without disturbing what it serves

Anything a host has to say about how it is running SHALL be reported where it can
be read without disturbing the conversations it is serving, and SHALL NOT appear
on any channel that belongs to a caller's request. The user SHALL be able to ask
whether a host is running and what it is serving.

#### Scenario: A notice while serving

- **WHEN** the host has something to report while it is serving a caller
- **THEN** the report does not appear on the channel carrying that caller's
  conversation, and what is being served is not disturbed

#### Scenario: Asking after the host

- **WHEN** the user asks whether a host is running
- **THEN** the answer says whether one is and, if so, which conversations it
  serves

### Requirement: A caller's request carries everything about the caller's files

Where a host answers a request about a program, everything about the caller's
files SHALL be settled by the caller, not by the host: the program's text, the
text of anything else the request reads, and any location the caller names SHALL
reach the host already resolved, and anything the request produces as a file
SHALL be written by the caller. A host SHALL NOT resolve a location relative to
wherever it happens to be running.

#### Scenario: A caller elsewhere

- **WHEN** a caller in one place makes a request of a host running in another,
  naming files by paths relative to the caller
- **THEN** the request is answered about the caller's files, and anything
  produced is written where the caller asked

### Requirement: The verdict a caller reports is the verdict the host reached

A caller SHALL report the outcome of a request answered by a host exactly as it
reports one it answered itself: the same distinction between the request having
worked, the caller having asked for something impossible, and the program itself
being at fault, and the same separation of what was asked for from everything
said about how the work went.

Being unable to reach or start a host SHALL be reported as its own failure and
SHALL NOT be reported as a program being at fault.

#### Scenario: A program at fault, answered by a host

- **WHEN** a request about a program with a fatal problem is answered by a host
- **THEN** the caller reports it with the outcome reserved for a program at
  fault, exactly as it would have answering the request itself

#### Scenario: A host that could not be reached

- **WHEN** a caller can neither reach a host nor start one
- **THEN** it reports that, and does not report the program as being at fault

### Requirement: The host behaves the same on every supported system

Everything this capability guarantees — being reached, being found, being
started, being stopped, holding machines and letting them go — SHALL hold on
Windows, on macOS and on Linux alike. Where the underlying system provides a
different kind of channel, the difference SHALL be invisible to the user: no
command, no option and no reported outcome SHALL differ between them.

#### Scenario: The same commands everywhere

- **WHEN** the same sequence of commands is given on Windows, on macOS and on
  Linux
- **THEN** each reports the same outcomes, and none requires an option the others
  do not
