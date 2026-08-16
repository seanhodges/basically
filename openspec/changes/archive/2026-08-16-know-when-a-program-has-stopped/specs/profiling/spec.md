## ADDED Requirements

### Requirement: A timing always reaches an ending

A timing SHALL end by itself when the program ends, on every machine. A user who
starts a program and lets it finish SHALL be shown the time it took, without
having to stop the run to obtain a figure.

The IDE SHALL NOT present any machine as unable to observe a program finishing,
because none is.

#### Scenario: A timing ends without the user intervening

- **WHEN** the user times a program that finishes, on any registered machine
- **THEN** the timing ends by itself and reports the time the program took

#### Scenario: No machine is described as unable to see a finish

- **WHEN** the user times a program on any registered machine
- **THEN** nothing in what they are shown says the machine cannot observe the
  program finishing

## REMOVED Requirements

### Requirement: A machine that cannot observe a finish says so

**Reason**: Every machine now reports whether a BASIC program is executing, so
there is no machine for this requirement to describe. Its guarantee — that a
duration is never presented as a completion time unless a completion was
observed — is unaffected and continues to be carried by "A timing states how it
ended".

**Migration**: A timing on one of the five machines this covered (the ZX80,
ZX81, both Spectrums and the Atom) now ends in a finish like any other, instead
of ending only when the user stops the run or execution pauses. Nothing the user
did before stops working: stopping a run and pausing still end a timing, and
still say so.
