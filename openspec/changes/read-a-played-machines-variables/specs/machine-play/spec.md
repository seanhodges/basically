## MODIFIED Requirements

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

What a program's variables hold SHALL be read on those terms, as the screen is:
it is taken without spending the machine's frames and without changing anything
about it, so it is a read of a moving machine rather than a measurement of a run.
What accounts for a run in the frames whoever is playing is spending — where its
time went, how long it took — SHALL remain a measurement and SHALL remain
refused, because those figures mean nothing about frames the caller did not ask
for.

A caller refused a measurement SHALL be told what it can still read, so that
being refused one request never leaves it guessing at which others are available.

When the play channel ends, the machine SHALL stop advancing unasked and SHALL
again be a machine that advances only when a request asks it to, with every
guarantee that rests on this restored.

#### Scenario: A machine advancing with nothing asked of it

- **WHEN** a machine is being played and a program on it is running
- **THEN** it goes on advancing without any request having asked it to

#### Scenario: Measuring a machine that is being played

- **WHEN** the caller holding a machine that is being played asks for a
  measurement of it
- **THEN** it is refused, told that the machine is being played, told how to stop
  playing, and told what it can still read

#### Scenario: Reading a machine that is being played

- **WHEN** the caller reads the screen of a machine that is being played, twice
- **THEN** each read is answered, and the two may differ without that being
  reported as a fault

#### Scenario: Reading the variables of a machine that is being played

- **WHEN** the caller reads the variables of a machine that is being played, and
  the program goes on running between the two reads
- **THEN** each read is answered with what the variables held as it was taken,
  and the two may differ without that being reported as a fault

#### Scenario: A machine being played that cannot report its variables

- **WHEN** the caller reads the variables of a played machine that cannot report
  them
- **THEN** it is told that this machine cannot report them, rather than being
  refused for the machine being played

#### Scenario: After the channel ends

- **WHEN** a play channel ends and the caller still holds its machine
- **THEN** the machine stops advancing unasked, and requests that measure it are
  answered again
