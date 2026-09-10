# machine-play Specification

## Purpose
TBD - created by archiving change play-a-machine-from-another-app. Update Purpose after archive.
## Requirements
### Requirement: A caller holding a machine can obtain a play channel

A caller that holds a machine SHALL be able to ask for that machine to be
played, and SHALL be given an address at which it can be. What is at that
address SHALL be showable by anything that can show a web page, so that an
application embedding the toolchain can put it in a frame of its own without
having to understand how the picture is carried or how a key gets back.

Asking a second time while a play channel is already open SHALL give the same
channel rather than opening another, so that a caller that loses track of its
address can recover it.

A caller that holds no machine SHALL be told so and told how to get one, on the
same terms as any other request that needs a machine before one is up. A machine
whose display cannot be pictured SHALL be refused a play channel, saying so,
rather than being given an address that shows nothing.

#### Scenario: Asking for a play channel

- **WHEN** a caller holding a machine asks for it to be played
- **THEN** it is given an address, and what is at that address shows that
  machine's display and sends what is typed there to the machine

#### Scenario: Asking twice

- **WHEN** a caller asks for a play channel while it already has one
- **THEN** it is given the channel it already has, and no second one is opened

#### Scenario: Asking before a machine is up

- **WHEN** a caller asks for a play channel while holding no machine
- **THEN** it is told that no machine is up and how to start one

#### Scenario: A machine that cannot be pictured

- **WHEN** a caller asks to play a machine whose display cannot be pictured
- **THEN** it is told so, rather than given an address that shows nothing

### Requirement: Whoever holds a play channel drives the machine

Keys pressed at a play channel SHALL reach the machine as the machine's own
keys, and SHALL mean there exactly what the same keys mean when a schedule
presses them, so that a program driven by hand and the same program driven by a
written schedule are driven by the same keyboard.

The display SHALL follow the machine as it runs, at the machine's own rate, so
that a keypress and the machine's answer to it are both seen. Where the display
changes faster than the channel can carry it, the most recent picture SHALL be
shown rather than an accumulating backlog of older ones.

#### Scenario: Typing at a machine

- **WHEN** someone holding a play channel types at a program waiting for input
- **THEN** the machine receives those keys and the display shows it responding

#### Scenario: The same key either way

- **WHEN** a key is pressed at a play channel, and the same key is named in a
  schedule
- **THEN** the machine receives the same key in both cases

#### Scenario: A machine changing faster than the channel can carry

- **WHEN** a machine's display changes faster than the channel can show it
- **THEN** the most recent picture is shown rather than a backlog of older ones

### Requirement: A machine being played runs on its own clock and is not being measured

While a machine is being played it SHALL advance continuously, at its own rate,
whether or not any request has asked it to. This is the only circumstance in
which a held machine advances unasked, and it SHALL last only as long as the
play channel does.

Because such a machine is being driven by a person rather than by requests,
nothing taken from it SHALL be offered as a measurement. While a machine is
being played, requests from the caller holding it that act on that machine or
measure it SHALL be refused, saying that the machine is being played and how to
stop. Requests that only read the machine SHALL be answered, and SHALL be
understood to have caught a machine that is moving: reading twice MAY give
different answers, and this SHALL NOT be reported as a fault.

When the play channel ends, the machine SHALL stop advancing unasked and SHALL
again be a machine that advances only when a request asks it to, with every
guarantee that rests on this restored.

#### Scenario: A machine advancing with nothing asked of it

- **WHEN** a machine is being played and a program on it is running
- **THEN** it goes on advancing without any request having asked it to

#### Scenario: Measuring a machine that is being played

- **WHEN** the caller holding a machine that is being played asks for a
  measurement of it
- **THEN** it is refused, told that the machine is being played, and told how to
  stop playing

#### Scenario: Reading a machine that is being played

- **WHEN** the caller reads the screen of a machine that is being played, twice
- **THEN** each read is answered, and the two may differ without that being
  reported as a fault

#### Scenario: After the channel ends

- **WHEN** a play channel ends and the caller still holds its machine
- **THEN** the machine stops advancing unasked, and requests that measure it are
  answered again

### Requirement: A play channel carries a machine's keyboard and screen and nothing else

Whoever holds a play channel SHALL be able to see the machine's display and type
at it, and nothing more. They SHALL NOT be able to start or stop the machine,
load or run a program, reach any operation the toolchain offers, or learn
anything about the computer the host is running on beyond the machine itself.

Whoever plays SHALL NOT be a caller: they SHALL hold no machine of their own,
and their arrival, presence or departure SHALL NOT change what the caller
holding the machine may do, beyond what this capability already states about a
machine being played.

#### Scenario: Attempting more than playing

- **WHEN** whoever holds a play channel attempts anything other than watching the
  display and typing at the machine
- **THEN** nothing further is done and nothing about the toolchain is reached

#### Scenario: The holder keeps its machine

- **WHEN** someone opens a play channel, plays and closes it
- **THEN** the caller holding the machine holds the same machine throughout

### Requirement: Possession of a play channel's address is what admits whoever plays

A play channel SHALL be reachable only from the computer the host is running on,
and SHALL be admitted on possession of its address alone. The address SHALL be
unguessable, SHALL be different for every channel, and SHALL NOT be reused once
a channel has ended.

Because an embedding application may show a play channel from a page of its own,
no restriction on who may embed it SHALL be relied upon as protection. The
address SHALL therefore be the only thing protecting it.

What that address admits is acting on a machine and not merely watching one, and
the product SHALL say so in those terms wherever playing is documented — as its
own statement rather than by reference to what a view's address admits, so that
a reader cannot carry the weaker claim across to the stronger one.

A play channel SHALL NOT disclose its address to the pages that embed it or to
anything they in turn reach.

#### Scenario: Reaching a play channel from elsewhere

- **WHEN** something on another computer tries to reach a play channel's address
- **THEN** it is neither shown the display nor able to type at the machine

#### Scenario: Guessing an address

- **WHEN** something on the same computer tries an address it was not given
- **THEN** it is neither shown the display nor able to type at the machine

#### Scenario: An address that has ended

- **WHEN** a play channel has ended and its address is used again
- **THEN** it admits nothing, and that address is never given to another channel

### Requirement: A play channel exists only while it has been asked for

No play channel SHALL be opened, and nothing SHALL be reachable at any network
address on its account, unless a caller has asked for one. Starting the host
SHALL NOT by itself make anything reachable that way.

A play channel SHALL end when the caller that asked for it gives it up,
disconnects, disappears, or the host stops. Once it has ended, nothing SHALL
remain reachable at its address. A caller SHALL be able to give up a play
channel without giving up its machine.

#### Scenario: A host nobody has asked to play from

- **WHEN** a host is running and no caller has asked for a play channel
- **THEN** nothing is reachable at any network address on its account

#### Scenario: The caller goes away

- **WHEN** a caller holding a play channel disconnects or disappears
- **THEN** the channel ends, the machine stops advancing unasked, and nothing
  remains reachable at its address

#### Scenario: Giving up the channel but keeping the machine

- **WHEN** a caller gives up its play channel
- **THEN** the channel ends, and the caller still holds its machine and can go on
  acting on it

### Requirement: A play channel says what it is showing, including when there is nothing

A play channel SHALL make plain what state it is in, so that a still picture is
never ambiguous. It SHALL say when there is no machine to play rather than
showing a blank or stale picture as though it were the machine, and SHALL say
when the machine it was playing has gone.

Where the caller holding the channel replaces its machine with another, the
channel SHALL follow the caller and play the new machine.

#### Scenario: The machine is replaced

- **WHEN** the caller holding a play channel runs a program on a new machine
- **THEN** the channel plays the new machine

#### Scenario: The machine is released

- **WHEN** the caller holding a play channel releases its machine but keeps the
  channel
- **THEN** the channel says no machine is up, rather than showing the machine
  that has gone

