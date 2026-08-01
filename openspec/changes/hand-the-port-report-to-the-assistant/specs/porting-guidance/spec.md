## MODIFIED Requirements

### Requirement: Carrying out the port targets the machine chosen

Where the comparison offers to carry the port out, it SHALL convert the program
for the machine the user selected as the target.

Carrying the port out SHALL additionally hand the assistant what the comparison
worked out for this program: the machine being ported from and the BASIC it runs,
the commands the program uses that the target lacks together with any advice
written for them, the commands to rename, the commands whose behaviour differs,
the commands that mean something different under the same name, the control codes
that must change, and the guidance specific to this pair and this target.

What is handed over SHALL be narrowed to the program being converted, as the
comparison's own report is, so it describes this port rather than the two
machines in general.

#### Scenario: Converting to a specific machine

- **WHEN** the user selects a machine as the target and asks for the port to be
  carried out
- **THEN** the program is converted for that machine, and the IDE continues on
  that machine

#### Scenario: Converting to a machine that shares a BASIC with a relative

- **WHEN** the user selects a machine whose BASIC a close relative also runs,
  and asks for the port to be carried out
- **THEN** the program is converted for the machine selected, not for its
  relative

#### Scenario: The port is carried out with the differences reported

- **WHEN** the user asks for the port to be carried out
- **THEN** the assistant is given the differences the comparison reported for
  this program, rather than only the name of the target machine

#### Scenario: Differences the program does not touch

- **WHEN** the comparison has reported differences for commands the program does
  not use
- **THEN** those are not handed over, because they are not work this port
  requires
