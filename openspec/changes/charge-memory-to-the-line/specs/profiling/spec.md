## ADDED Requirements

### Requirement: Memory is charged to the line that took it, and says so

Where the machine reports its own BASIC memory figures, the IDE SHALL charge the
growth in memory to the BASIC line that was executing when it grew, and SHALL
report the lines that took the most, so that a program's memory can be traced to
a place in the program rather than only to a moment in the run.

Memory SHALL be charged flat, as time is: memory taken inside a subroutine SHALL
be charged to the subroutine's own lines and SHALL NOT be charged to the line
that called it. Where the IDE can identify a program's named routines and the
destinations its program jumps to, it SHALL offer the memory summed over each of
those.

The figure SHALL be gross rather than net: memory the program takes and BASIC
later reclaims SHALL still be counted against the line that took it, because
that churn is what a reclaim pause is made of and a net figure would report the
line responsible for one as having taken nothing.

Memory SHALL be reported in bytes. A share of the run answers "where did the
time go" because machines are clocked differently, but "how much memory" is
asked and answered in the machine's own bytes.

The per-line reading SHALL account for exactly the memory the run's own memory
account accounts for, and no more. Where a machine's reported figure does not
move as the program runs, no line SHALL be reported as having taken memory, and
the IDE SHALL say that none did rather than leaving the reading blank.

Because neither the flat accounting nor the gross figure is the only conceivable
one, the IDE SHALL state both where it presents the bytes, so that a user is not
left to infer that a line's figure includes what it calls, or that a line whose
memory was reclaimed took none.

#### Scenario: The line that builds the strings carries the bytes

- **WHEN** a program repeatedly extends a string on one line and prints it on
  the next
- **THEN** the bytes are reported against the line that extends the string, and
  the line that prints it is not credited with them

#### Scenario: A subroutine's memory lands on the subroutine

- **WHEN** a program takes most of its memory inside a subroutine called from a
  loop
- **THEN** the subroutine's lines carry those bytes, and the calling line carries
  only what it takes itself

#### Scenario: Memory per routine

- **WHEN** the user asks for a measured program's memory by routine
- **THEN** each named routine and jump destination the IDE can identify is
  reported with the run's bytes summed across its lines

#### Scenario: Reclaimed memory is still charged

- **WHEN** a program takes memory on one line and BASIC later reclaims it
- **THEN** that line is still reported as having taken those bytes, rather than
  as having taken none

#### Scenario: The accounting is disclosed

- **WHEN** the user reads the memory charged to a line where the IDE presents it
- **THEN** that figure carries a statement that it excludes the routines the
  line calls and that memory reclaimed afterwards is not subtracted

#### Scenario: A line that took no memory

- **WHEN** a measured program has lines that take no memory at all
- **THEN** those lines are absent from the reading rather than listed as zero

#### Scenario: A run whose memory account never moves

- **WHEN** a program runs on a machine whose reported memory figure does not
  change over the run
- **THEN** the IDE states that no line took measurable memory, rather than
  showing a blank reading or a ranking of zeroes
