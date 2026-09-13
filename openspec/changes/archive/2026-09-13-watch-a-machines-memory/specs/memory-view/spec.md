## ADDED Requirements

### Requirement: A caller holding a machine can obtain a map of its memory

A caller that holds a machine SHALL be able to ask for a map of that machine's
memory, and SHALL be given an address at which the map can be seen. What is at
that address SHALL be showable by anything that can show a web page, so that an
application embedding the toolchain can put it in a frame of its own without
having to understand how the map is carried.

The map SHALL show the machine's memory layout as `memory-map` describes it, and
SHALL show what the machine is touching as the program runs.

A caller that asks again while it already has a map SHALL be given the map it
already has, rather than a second projection of one machine.

A caller with no way to project anything SHALL be told so, and a caller whose
machine has no described memory layout SHALL be told that instead, rather than
being given an address showing nothing.

#### Scenario: Asking for a map

- **WHEN** a caller that holds a machine asks for a map of its memory
- **THEN** it is given an address, and what is at that address shows the
  machine's memory layout

#### Scenario: Asking twice

- **WHEN** a caller that already has a map of its machine's memory asks for one
  again
- **THEN** it is given the address it already has, and is told that this is the
  map it already had

#### Scenario: A machine with no described layout

- **WHEN** the caller holding a machine whose memory layout the toolchain does
  not describe asks for a map of it
- **THEN** no address is given, and the caller is told that this machine's
  memory cannot be mapped

#### Scenario: A caller that can project nothing

- **WHEN** a caller with no way to serve a projection asks for a map
- **THEN** no address is given, and the caller is told that a map is served by a
  host holding the machine for it

### Requirement: A map shows what the machine is touching, or says it cannot

Where the machine can report which addresses its processor touches, the map
SHALL show them as the program runs, and SHALL distinguish a read from a write.

Where the machine cannot report them, the map SHALL say that this machine cannot
report what it is touching. It SHALL NOT present an unmarked layout as a program
that touched no memory: a machine that cannot say and a program that did nothing
are different answers and SHALL be given as different answers.

#### Scenario: Watching a program work

- **WHEN** a program runs on a machine whose memory is being mapped and whose
  processor's accesses can be reported
- **THEN** the addresses it reads and the addresses it writes are shown on the
  map as it runs, told apart from one another

#### Scenario: A machine whose accesses cannot be reported

- **WHEN** the machine being mapped has a described layout but cannot report
  which addresses its processor touches
- **THEN** the layout is shown and the map states that this machine cannot
  report what it is touching

### Requirement: A map says what it is showing, including when there is nothing

A map SHALL say what it is showing, so that a still picture is never ambiguous.
It SHALL distinguish a machine that is working from one that is between
requests, and SHALL say when there is no machine at all.

Because a held machine advances only when something asks it to, a map SHALL NOT
be read as a claim that the machine is running. What it shows when nothing is
asking anything of the machine is what the machine last did.

Where the machine a map was showing is let go, the map SHALL say that there is
no machine rather than leave a picture of one that has gone, and its address
SHALL go on working, because the map belongs to the caller rather than to any
one machine. Where that caller runs another program, the map SHALL show the new
machine at the same address.

#### Scenario: Between requests

- **WHEN** nothing is asking anything of a machine whose memory is being mapped
- **THEN** the map says the machine is not working, and shows what it last did

#### Scenario: The machine is let go

- **WHEN** the caller releases the machine whose memory is being mapped
- **THEN** the map says there is no machine, and stops showing the one that has
  gone

#### Scenario: Another program on the same address

- **WHEN** the caller runs another program after its machine was let go
- **THEN** the map at the address it already has shows the new machine

### Requirement: Whoever is shown a map watches memory and can do nothing else

Whoever holds a map's address SHALL be able to see the machine's memory layout
and what it is touching, and nothing more. They SHALL NOT be able to act on the
machine, read what any address holds, change what any address holds, load or run
a program, reach any operation the toolchain offers, or learn anything about the
computer the host is running on beyond the machine itself.

Whoever is shown a map SHALL NOT be a caller: they SHALL hold no machine of
their own, and their arrival, presence or departure SHALL NOT change what the
caller holding the machine may do.

#### Scenario: Attempting more than watching

- **WHEN** whoever holds a map's address attempts anything other than watching
  the map
- **THEN** nothing further is done and nothing about the toolchain is reached

#### Scenario: Asking what an address holds

- **WHEN** whoever holds a map's address seeks the value stored at any address
  of the machine's memory
- **THEN** it is not available, because a map reports which addresses were
  touched and never what they hold

#### Scenario: The holder keeps its machine

- **WHEN** someone opens a map, watches it and closes it
- **THEN** the caller holding the machine holds the same machine throughout

### Requirement: Possession of a map's address is what admits whoever watches

A map SHALL be reachable only from the computer the host is running on, and
SHALL be admitted by possession of its address alone. An address SHALL be
unguessable, SHALL belong to one map, and SHALL never be issued a second time.

An address whose map has ended SHALL be answered exactly as an address that
never existed, so that nothing can be learned from the difference.

The map SHALL take care not to pass its address on to whatever the page
embedding it reaches next, since the address is the whole of what protects it.

#### Scenario: Reaching a map from elsewhere

- **WHEN** something not on the computer the host is running on tries to reach a
  map's address
- **THEN** it is not reachable

#### Scenario: An address that was never issued

- **WHEN** an address that no map was ever given is used
- **THEN** it is answered exactly as an address whose map has ended

### Requirement: A map exists only while it has been asked for

Nothing SHALL be reachable at any address until a caller has asked for a
projection, and a host that has been asked for none SHALL be reachable at no
address at all.

A caller SHALL be able to give up its map while keeping its machine, and the
machine SHALL be unchanged by that. A map SHALL end when the caller that asked
for it goes, and an address whose map has ended SHALL show nothing thereafter.

Whoever is watching a map SHALL NOT keep a host alive: a host with no caller
SHALL let itself go on the terms it otherwise would, however many maps are being
watched.

#### Scenario: A host nobody has asked for a projection

- **WHEN** a host has served callers but none has asked for any projection
- **THEN** it is reachable at no address

#### Scenario: Giving up a map

- **WHEN** the caller holding a mapped machine gives up its map
- **THEN** the address stops showing anything, and the caller goes on acting on
  the machine it still holds

#### Scenario: Watching does not keep a host alive

- **WHEN** every caller has gone and a map is still being watched
- **THEN** the host lets itself go as it otherwise would

### Requirement: Mapping a machine changes nothing about what it does or what it measures

A machine SHALL be recorded only while something is watching a map of it, so a
machine nobody is mapping pays nothing for the recording.

Mapping SHALL NOT advance the machine, and SHALL NOT change what a program does
or how long it takes in the machine's own time. Every measurement the toolchain
reports SHALL be the same whether or not a map is open, and what mapping costs
the host SHALL NOT be charged to the program.

Asking for a map SHALL be answered while the machine is being played, since it
only reads the machine; and what a map shows of a machine that is moving MAY
differ between one moment and the next without that being a fault.

#### Scenario: The same run, mapped and unmapped

- **WHEN** the same program is run twice on the same machine, once with a map
  open and once without
- **THEN** both runs report the same measurements

#### Scenario: Mapping a machine that is being played

- **WHEN** the caller holding a machine that is being played asks for a map of
  its memory
- **THEN** it is answered, and the machine goes on being played unchanged

#### Scenario: A machine nobody is mapping

- **WHEN** a program runs on a machine no map is open on
- **THEN** nothing about what its processor touches is recorded
