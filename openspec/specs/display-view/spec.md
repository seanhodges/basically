# display-view Specification

## Purpose

Let a held machine's display be watched, not only sampled. A caller that holds a
machine may ask for a view of it and is given an address anything that shows a
web page can show, so a person supervising an agent, or an application embedding
the toolchain in a frame of its own, can keep eyes on the screen while the
machine is driven. A view mirrors and never drives: the machine advances only
when a request asks it to, measurements are identical whether or not anyone is
watching, and a viewer receives a picture and nothing else.
## Requirements
### Requirement: A caller holding a machine can obtain a view of its display

A caller that holds a machine SHALL be able to ask for a view of that machine's
display, and SHALL be given an address at which the display can be seen. What is
at that address SHALL be showable by anything that can show a web page, so that
an application embedding the toolchain can put it in a frame of its own without
having to understand how the picture is carried.

Asking a second time while a view is already open SHALL give the same view
rather than opening another, so that a caller that loses track of its address can
recover it.

A caller that holds no machine SHALL be told so and told how to get one, on the
same terms as any other request that needs a machine before one is up. A machine
whose display cannot be pictured SHALL be refused a view, saying so, rather than
being given an address that shows nothing.

#### Scenario: Asking for a view

- **WHEN** a caller holding a machine asks for a view of it
- **THEN** it is given an address, and what is at that address shows that
  machine's display

#### Scenario: Asking twice

- **WHEN** a caller asks for a view while it already has one
- **THEN** it is given the view it already has, and no second view is opened

#### Scenario: Asking before a machine is up

- **WHEN** a caller asks for a view while holding no machine
- **THEN** it is told that no machine is up and how to start one

#### Scenario: A machine that cannot be pictured

- **WHEN** a caller asks for a view of a machine whose display cannot be pictured
- **THEN** it is told so, rather than given an address that shows nothing

### Requirement: A view mirrors the machine and never drives it

A view SHALL show the machine's display as it is, and SHALL NOT cause the machine
to advance. The machine SHALL go on advancing only when a request asks it to, so
that between requests a view holds the picture the last request left, and while a
request is working the view follows what that request does.

Whether a machine is being viewed SHALL make no difference to what any request
answers. Every measurement taken in the machine's own time SHALL be identical
whether or not anyone is watching, because a view spends none of the machine's
frames. Where a request reports how long it took on the computer running it, the
cost of serving the view SHALL be excluded from that figure, so that a run does
not appear to have taken longer because someone was watching it.

Where a view cannot keep up with a machine that is changing quickly, it SHALL
show the most recent picture it can rather than falling behind, so that what a
viewer sees is always the machine's present rather than its past.

#### Scenario: Nothing happening

- **WHEN** a machine is being viewed and no request is made of it for a while
- **THEN** the view goes on showing the picture the last request left, and the
  machine does not advance

#### Scenario: Watching a request work

- **WHEN** a request advances a machine that is being viewed
- **THEN** the view follows the display as that request works, and settles on
  what the request left

#### Scenario: Measurement is unaffected by being watched

- **WHEN** the same program is run and measured with a view open, and again with
  none
- **THEN** every measurement taken in the machine's own time is identical, and
  the run does not report having taken longer for having been watched

#### Scenario: A machine changing faster than the view can carry

- **WHEN** a machine's display changes faster than the view can show it
- **THEN** the viewer is shown the most recent picture rather than an
  accumulating backlog of older ones

### Requirement: A viewer receives a picture and can do nothing else

A viewer SHALL be able to see the display and nothing more. It SHALL NOT be able
to type at the machine, start or stop it, load or run a program, reach any
operation the toolchain offers, or learn anything about the computer the host is
running on beyond the picture itself.

A viewer SHALL NOT be a caller: it SHALL hold no machine of its own, and its
arrival, presence or departure SHALL NOT change what the caller holding the
machine sees or is allowed to do.

#### Scenario: A viewer trying to act

- **WHEN** a viewer attempts anything other than watching
- **THEN** nothing is done to the machine and nothing about the toolchain is
  reached

#### Scenario: The holder is unaffected

- **WHEN** a viewer opens, watches and closes a view
- **THEN** the caller holding the machine is neither disturbed nor restricted at
  any point, and holds the same machine throughout

### Requirement: A view says what it is showing, including when there is nothing

A view SHALL make plain what state it is in, so that a still picture is never
ambiguous. It SHALL distinguish a machine that is idle from one a request is
currently working on, and SHALL say when there is no machine to show rather than
showing a blank or stale picture as though it were the machine.

Where the caller holding the view replaces its machine with another, the view
SHALL follow the caller and show the new machine. Where the caller releases its
machine without giving up the view, the view SHALL say that no machine is up
rather than continuing to show the machine that has gone.

#### Scenario: Idle versus working

- **WHEN** a viewer watches a machine that is idle, and then watches while a
  request works on it
- **THEN** the view distinguishes the two, rather than showing an unchanging
  picture in both cases

#### Scenario: The machine is replaced

- **WHEN** the caller holding a view runs a program on a new machine
- **THEN** the view shows the new machine

#### Scenario: The machine is released

- **WHEN** the caller holding a view releases its machine but keeps the view
- **THEN** the view says no machine is up, rather than showing the machine that
  has gone

### Requirement: Possession of a view's address is what admits a viewer

A view SHALL be reachable only from the computer the host is running on, and
SHALL be admitted on possession of its address alone. The address SHALL be
unguessable, SHALL be different for every view, and SHALL NOT be reused once a
view has ended.

Because an embedding application may show a view from a page of its own, no
restriction on who may embed it SHALL be relied upon as protection. The address
SHALL therefore be the only thing protecting a view, and the product SHALL say so
plainly wherever a view is documented, rather than implying protection it does
not have.

A view SHALL NOT disclose its address to the pages that embed it or to anything
they in turn reach.

#### Scenario: Reaching a view from elsewhere

- **WHEN** something on another computer tries to reach a view's address
- **THEN** it is not shown the display

#### Scenario: Guessing an address

- **WHEN** something on the same computer tries an address it was not given
- **THEN** it is not shown the display

#### Scenario: An address that has ended

- **WHEN** a view has ended and its address is used again
- **THEN** it is not shown the display, and that address is never given to
  another view

### Requirement: A view exists only while it has been asked for

No view SHALL be projected, and nothing SHALL be reachable at any network
address, unless a caller has asked for one. Starting the host SHALL NOT by itself
make anything reachable that way.

A view SHALL end when the caller that asked for it gives it up, disconnects,
disappears, or the host stops. Once it has ended, nothing SHALL remain reachable
at its address. A caller SHALL be able to give up a view without giving up its
machine.

#### Scenario: A host nobody has asked for a view from

- **WHEN** a host is running and no caller has asked for a view
- **THEN** nothing is reachable at any network address

#### Scenario: The caller goes away

- **WHEN** a caller holding a view disconnects or disappears
- **THEN** the view ends and nothing remains reachable at its address

#### Scenario: Giving up a view but keeping the machine

- **WHEN** a caller gives up its view
- **THEN** the view ends, and the caller still holds its machine and can go on
  acting on it

### Requirement: A view is not a play channel, and a machine has one or the other

A view and a play channel are different projections of a held machine, and the
difference SHALL be plain wherever either is documented. A view mirrors and never
drives, and every guarantee this capability makes about a view holds unchanged. A
play channel drives, on the terms `machine-play` states.

A machine SHALL have at most one of the two at any moment. Where the caller
holding a machine that is being viewed asks for it to be played, the view SHALL
end and the play channel SHALL open, and the caller SHALL be told that this is
what happened rather than being left with an address that has quietly stopped
working. The same SHALL hold in the other direction.

Because a view exists so that a machine driven by requests can be watched, and a
played machine is already being seen by whoever is driving it, no machine SHALL
be projected both ways at once, and nothing about a view's guarantees SHALL be
read as applying to a play channel.

#### Scenario: Playing a machine that is being viewed

- **WHEN** the caller holding a machine that is being viewed asks for it to be
  played
- **THEN** the view ends, a play channel opens, and the caller is told the view
  has ended

#### Scenario: Viewing a machine that is being played

- **WHEN** the caller holding a machine that is being played asks for a view of
  it
- **THEN** the play channel ends, a view opens, and the caller is told the play
  channel has ended

#### Scenario: An address that belonged to the projection that ended

- **WHEN** one projection has replaced the other and the ended projection's
  address is used again
- **THEN** it shows nothing, on the same terms as any address whose projection
  has ended

