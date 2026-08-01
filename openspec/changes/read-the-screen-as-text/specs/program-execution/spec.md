## MODIFIED Requirements

### Requirement: Runtime state is visible to the IDE

Where the machine can introspect them, the IDE SHALL surface the running
program's BASIC runtime report (errors), its variables, its actual RAM usage,
and the contents of its screen as text; machines that cannot report a figure
fall back gracefully rather than showing stale data.

Screen text SHALL be the characters the program put on the screen, in reading
order, for every machine that can determine them — including machines whose
display holds no characters, where they SHALL be recovered from what is
displayed.

#### Scenario: Live memory readout

- **WHEN** a program is running on a machine that reports RAM figures
- **THEN** the status display shows the machine's own used/free figures
  instead of the pre-run estimate

#### Scenario: Reading back what a program printed

- **WHEN** a program has printed to the screen on a machine that can report its
  screen as text
- **THEN** the printed characters are available to the IDE in reading order

#### Scenario: A machine whose display holds no characters

- **WHEN** a program has printed to the screen on a machine that stores its
  display only as an image
- **THEN** the printed characters are still reported, recovered from what is
  displayed

#### Scenario: A machine that cannot report its screen

- **WHEN** the IDE asks a machine that cannot determine its screen text
- **THEN** no screen text is reported, and every other runtime figure is
  unaffected
