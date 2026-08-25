## ADDED Requirements

### Requirement: Strict characters removes the case affordance, not the keyboard

While the Strict characters setting is on and the target machine has no lower
case, the on-screen keyboard SHALL offer no way to shift letter case: the
machine's shift key SHALL NOT be offered, and what the keyboard types into the
editor SHALL be upper case.

This SHALL cost the user no character and no function. Where a machine's shift
key is also the route to something that is not letter case — a further page of
symbols, a cursor set, or a combination the machine's own keys produce — that
route SHALL remain available. A key that is not the machine's shift SHALL NOT be
hidden by this setting, however it is styled: a control key drawn like a shift
SHALL keep working, including the combination that interrupts a running program.

The keyboard's shape SHALL NOT change: the rows SHALL stay laid out as they
were, rather than reflowing around the missing key.

While the setting is off, or on a machine that has lower case, the keyboard
SHALL be unaffected.

#### Scenario: A machine with no lower case, strictly

- **WHEN** Strict characters is on and the user opens the on-screen keyboard for
  a machine with no lower case
- **THEN** no shift key is offered, the letters type in upper case, and the rows
  are laid out as they were

#### Scenario: The symbol page survives

- **WHEN** Strict characters is on for a machine whose shift key is also the way
  to reach a further page of symbols
- **THEN** that page is still reachable, and every symbol the keyboard offered
  before is still reachable

#### Scenario: A control key is not a shift

- **WHEN** Strict characters is on for a machine carrying a control key drawn
  like its shift
- **THEN** the control key is still offered, and the combination that interrupts
  a running program still works

#### Scenario: A machine that has lower case

- **WHEN** Strict characters is on and the target machine can draw lower case
- **THEN** the keyboard is unchanged, and both cases remain reachable
