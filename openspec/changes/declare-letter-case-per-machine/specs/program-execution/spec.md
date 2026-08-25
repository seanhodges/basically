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

Screen text SHALL report the letter case the screen is showing. On a machine
that draws its lower case from a character set selected at run time, the set in
force SHALL decide the case reported. On a machine that displays every letter in
upper case whatever it stores, upper case SHALL be reported. A letter on screen
SHALL NOT be reported as a blank.

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

#### Scenario: A screen showing lower case

- **WHEN** a program has switched a machine to its lower-case character set and
  printed lower-case letters
- **THEN** the screen text reports those letters in lower case, not as upper case
  and not as blanks

#### Scenario: A machine that displays every letter in upper case

- **WHEN** a program has printed lower-case letters on a machine whose display
  draws only capitals
- **THEN** the screen text reports the capitals the screen is showing
