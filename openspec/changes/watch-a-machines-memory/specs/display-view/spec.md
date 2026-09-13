## MODIFIED Requirements

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

This rule is about the machine's **display**, and holds between the projections
that show it. A projection showing something other than the display SHALL be
neither ended by asking for a view or a play channel nor able to end one, and
SHALL be able to be open alongside either. In particular a map of the machine's
memory, on the terms `memory-view` states, is such a projection: asking for one
SHALL leave a view or a play channel exactly as it was, and asking for a view or
a play channel SHALL leave a map exactly as it was.

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

#### Scenario: Mapping a machine's memory while it is being played

- **WHEN** the caller holding a machine that is being played asks for a map of
  its memory
- **THEN** the map opens, the play channel goes on unchanged, and the caller is
  told nothing has ended

#### Scenario: Viewing a machine whose memory is being mapped

- **WHEN** the caller holding a machine whose memory is being mapped asks for a
  view of it, and then asks for it to be played
- **THEN** the view and then the play channel come and go as they always do, and
  the map stays open throughout at the address it was given
