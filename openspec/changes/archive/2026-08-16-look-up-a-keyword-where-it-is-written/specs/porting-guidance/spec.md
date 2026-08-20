## MODIFIED Requirements

### Requirement: The comparison is offered, not imposed, where it would cover the work

Where the documentation would take the whole screen, opening it unbidden would bury the very
program the user has just chosen to port. The IDE SHALL therefore not open it, and SHALL instead
show a brief indication of how to open it; opening the documentation without naming a topic while
that comparison is still current SHALL land on it rather than on the usual topic. Where the user
opens the documentation *on* something — asking to read a particular keyword, instruction or page —
they have named what they want, and the documentation SHALL show that instead.

Where the documentation would take only part of the screen, and so leaves the program in view, the
IDE SHALL open it on the comparison straight away and SHALL NOT show any indication.

Acting on the indication SHALL open the comparison. Any other interaction SHALL dismiss it
immediately, and it SHALL disappear on its own shortly after appearing, so it never stands between
the user and their program.

#### Scenario: Documentation would take the whole screen

- **WHEN** the user keeps their program while switching machine, and the documentation would cover
  the whole screen
- **THEN** the documentation does not open, and a brief indication of how to open it is shown

#### Scenario: Opening the documentation afterwards

- **WHEN** the user opens the documentation without naming a topic while that comparison is still
  current
- **THEN** it opens on that comparison rather than on the topic it would otherwise show

#### Scenario: Opening the documentation on a named topic

- **WHEN** the user opens the documentation on a particular keyword or instruction while that
  comparison is still current
- **THEN** it opens on what they named, and the comparison is still there to be opened afterwards

#### Scenario: Acting on the indication

- **WHEN** the user acts on the indication
- **THEN** the documentation opens on the comparison

#### Scenario: Dismissing the indication

- **WHEN** the user interacts with anything other than the indication
- **THEN** it disappears immediately, and the comparison is still there to be opened

#### Scenario: Leaving the indication alone

- **WHEN** the user does nothing
- **THEN** the indication disappears on its own, and the comparison is still there to be opened

#### Scenario: Documentation would take only part of the screen

- **WHEN** the user keeps their program while switching machine, and the documentation would leave
  the program in view
- **THEN** the documentation opens on the comparison, and no indication is shown
