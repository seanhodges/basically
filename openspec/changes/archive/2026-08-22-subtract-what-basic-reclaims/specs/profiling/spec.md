## MODIFIED Requirements

### Requirement: Memory is charged to the line that took it, and says so

Where the machine reports its own BASIC memory figures, the IDE SHALL charge the
change in memory to the BASIC line that was executing when it changed, and SHALL
report the lines that moved the most, so that a program's memory can be traced to
a place in the program rather than only to a moment in the run.

Memory SHALL be charged flat, as time is: memory taken inside a subroutine SHALL
be charged to the subroutine's own lines and SHALL NOT be charged to the line
that called it. Where the IDE can identify a program's named routines and the
destinations its program jumps to, it SHALL offer the memory summed over each of
those.

The figure SHALL be net: memory BASIC reclaims SHALL be charged to the line that
was executing when it was reclaimed and subtracted from what that line took, so
that a line's figure is what it was left holding. A line that gave back more than
it took SHALL be reported as having done so rather than as having taken nothing.

The bytes taken and the bytes reclaimed SHALL both be reported alongside the net,
for the run as a whole and for each line. A net figure alone cannot distinguish a
line that moved no memory from one that took a great deal and gave nearly all of
it back, and the second is what a reclaim pause is made of.

Memory SHALL be reported in bytes. A share of the run answers "where did the
time go" because machines are clocked differently, but "how much memory" is
asked and answered in the machine's own bytes.

The per-line reading SHALL account for exactly the memory the run's own memory
account accounts for, and no more. Where a machine's reported figure does not
move as the program runs, no line SHALL be reported as having moved memory, and
the IDE SHALL say that none did rather than leaving the reading blank.

Charging memory to a line requires observing the program leave that line, which
a program whose loop occupies a single line never does. Where the run's memory
figure moved and none of it could be charged to a line, the IDE MAY instead
report an approximate breakdown, derived from the lines that were executing
while it moved, and SHALL mark that breakdown as approximate wherever it is
shown. Falls SHALL be spread as rises are, so that an approximate reading nets as
a charged one does. An approximate breakdown SHALL NOT be combined with charged
figures in one reading: a reader given a mixture has no way to tell which figures
were measured, and a line that took nothing would be credited for the time it
spent.

The IDE SHALL distinguish a run in which no memory figure was ever read from one
in which figures were read and no memory was moved. The first is the absence of
a measurement and the second is a measurement.

Because the flat accounting is not the only conceivable one, the IDE SHALL state
it where it explains the bytes, so that a user is not left to infer that a line's
figure includes what it calls.

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

#### Scenario: Reclaimed memory is charged to the line that gave it back

- **WHEN** a program takes memory on one line and BASIC reclaims it while
  another line is executing
- **THEN** the reclaim is charged to the line that was executing when it
  happened and subtracted from that line's figure, so that line is reported as
  having given memory back

#### Scenario: A line that takes memory and gives it straight back

- **WHEN** a line takes memory and BASIC reclaims all of it while that same line
  is still the one executing
- **THEN** the line is still reported, with the bytes it took and the bytes
  reclaimed shown beside a net of nothing, rather than being omitted as a line
  that moved no memory

#### Scenario: A line that moved no memory

- **WHEN** a measured program has lines that neither take memory nor give any
  back
- **THEN** those lines are absent from the reading rather than listed as zero

#### Scenario: A run whose memory account never moves

- **WHEN** a program runs on a machine whose reported memory figure does not
  change over the run
- **THEN** the IDE states that no memory was taken, rather than showing a blank
  reading or a ranking of zeroes

#### Scenario: A loop written on a single line

- **WHEN** a program moves memory in a loop that occupies one line, so the
  program is never observed leaving the line that moves it
- **THEN** the IDE reports an approximate breakdown derived from the lines
  executing while memory moved, and states that it is approximate

#### Scenario: An approximate breakdown is not mixed with charged figures

- **WHEN** the IDE reports an approximate breakdown
- **THEN** every figure in that reading is approximate, and no line carries a
  charged figure alongside them

#### Scenario: No memory figure was ever read

- **WHEN** a run is measured but the machine never yields a memory figure
- **THEN** the IDE says that no readings were taken, distinctly from saying that
  no memory was taken
