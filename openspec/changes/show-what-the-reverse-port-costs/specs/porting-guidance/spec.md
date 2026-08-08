## ADDED Requirements

### Requirement: The comparison can be reversed, and says what the reverse costs

What a port costs depends heavily on which way it is going: the same two machines
can ask for several times as much work in one direction as in the other, and for
a reader choosing where to write a program — on the constrained machine and
expanding outward, or the other way — that is a real decision the comparison is
uniquely placed to inform.

The comparison SHALL offer a way to reverse the pair in one action, without the
reader re-choosing both machines. Before that action is taken, the comparison
SHALL report how much the reverse direction would ask for, against how much the
direction on screen asks for, so the choice is made on the difference rather than
by trying it.

The two figures SHALL be arrived at the same way as each other, and SHALL be
described as counts of what each direction reports rather than as a measure of
effort. They SHALL describe the two machines rather than the open program, and
SHALL say so where a program is narrowing the comparison, since a program written
for one machine cannot be read as the language of the other.

Reversing SHALL produce exactly the comparison that choosing those two machines
in that order produces: the same findings, the same shareable link, and the same
narrowing to the open program where there is one.

#### Scenario: Seeing what the reverse costs

- **WHEN** the user reads a comparison between two machines
- **THEN** the number of findings the reverse direction would report is shown
  against the number this direction reports

#### Scenario: Reversing the pair

- **WHEN** the user reverses the pair
- **THEN** the comparison shown is the one for those two machines in the opposite
  order, identical to what choosing them in that order produces

#### Scenario: The reversed comparison is shareable

- **WHEN** the user reverses the pair and shares the comparison as a link
- **THEN** the link reopens the reversed pair, in that direction

#### Scenario: Reversing with a program open

- **WHEN** the user reverses the pair with a program open
- **THEN** the comparison narrows to what that program uses read as the new source
  machine's BASIC, or says it cannot be read as that BASIC, exactly as choosing a
  new source machine does

#### Scenario: The counts describe the machines

- **WHEN** the comparison is narrowed to an open program
- **THEN** the two direction counts still describe what the two machines ask of
  each other, and say that they do
