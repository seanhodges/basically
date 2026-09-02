## MODIFIED Requirements

### Requirement: Guidance covers both the general and the machine-specific

The guidance SHALL describe what any port between these BASICs involves, independently of the pair
chosen, and SHALL additionally describe what is specific to the machine being ported **to**. Every
machine offered as a target SHALL carry its own guidance, so no valid pair produces a comparison
without it.

Its own guidance means the guidance written for that machine, not for a relative it shares a
reference page with. Where machines that share a page differ in what they offer for a capability,
in how they spell a command, or in what a port to them has to do instead, each SHALL be answered in
its own terms; where they do not differ, they MAY be answered alike. Guidance for a machine SHALL
NOT name a command that machine does not have, whatever a relative on its page has.

What any port involves does not change with the pair, so it SHALL be given a page of its own rather
than sit within the comparison, and the comparison SHALL point to it before the reader reaches the
pair-specific sections, naming it as the thing to read first by a reader new to porting.

#### Scenario: Guidance for any target

- **WHEN** the user selects any machine as the porting target
- **THEN** the guidance specific to that target is shown, and what any port involves is one link
  away, offered before the pair-specific sections

#### Scenario: Reading what any port involves

- **WHEN** the user follows that link
- **THEN** what any port between these BASICs involves is given in full

#### Scenario: Two machines on one page that differ

- **WHEN** the user ports to a machine whose reference page also covers a relative that offers a
  capability differently, or spells a command differently
- **THEN** the guidance shown answers for the machine chosen, not for its relative

#### Scenario: Guidance never reaches for a command the target lacks

- **WHEN** the guidance for a target names the commands to reach for in a capability
- **THEN** every command named is one that target itself has

#### Scenario: Porting between two machines that share a page

- **WHEN** the user compares two machines whose BASICs are versions of one another, and which read
  from one reference page
- **THEN** the comparison is of the two machines, with the guidance for the port between them
