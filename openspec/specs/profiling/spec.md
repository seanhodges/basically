# profiling Specification

## Purpose

Tell the user where a run actually went. Every run on a machine that can be
measured records itself — no mode to select, no second run under observation —
and reports each line's share of the time against the line in the editor, the
totals rolled up by routine, and the BASIC memory the program held across the
run. Every figure is the emulated machine's own time, so the emulation speed
never changes it.

## Requirements

### Requirement: Every run measures itself

Where the machine can be measured, running a program SHALL record where its time
went and how much memory it was using, without the user selecting a profiling
mode, arming a recorder, or running the program a second time.

A user who has just watched a program run slowly SHALL therefore already have
the measurements of that run, rather than having to reproduce the behaviour
under observation.

Measuring SHALL NOT change how the program runs: a measured run SHALL execute
the same instructions, take the same emulated time, and produce the same screen
and sound as an unmeasured one.

#### Scenario: A run is measured without being asked

- **WHEN** the user runs a program on a machine that can be measured
- **THEN** measurements of that run are available afterwards, without the user
  having enabled anything

#### Scenario: Measuring does not disturb the program

- **WHEN** the same program is run on a machine that records measurements and on
  one that cannot
- **THEN** the program behaves identically on both, and takes the same emulated
  time

### Requirement: Time is the machine's own time

Every duration the IDE reports about a program SHALL be time on the emulated
machine — the time the program would take on the hardware — and SHALL NOT be
time spent in the browser.

Consequently, changing how fast the IDE emulates the machine, or running on a
display that refreshes at a different rate, SHALL NOT change any reported
figure. The same program measured at real time and at a multiple of real time
SHALL report the same durations.

Where a duration is shown, the IDE SHALL make clear that it is the machine's
time rather than elapsed time in the browser.

#### Scenario: The speed multiplier does not change the figures

- **WHEN** the user measures a program at real time, then measures it again with
  the emulation speed multiplied
- **THEN** the reported durations are the same

#### Scenario: The host's display does not change the figures

- **WHEN** the same program is measured on displays with different refresh rates
- **THEN** the reported durations are the same

### Requirement: A line's share of the run is shown against the line

Where the machine can report the BASIC line it is executing, the IDE SHALL show
each line's share of the run's time beside that line in the editor, so the
costly lines are found by reading the program rather than by consulting a
separate report.

The display SHALL distinguish the lines that dominate the run from those that
are incidental to it, and SHALL leave a line that consumed no measured time
visually unmarked rather than marked as cheap.

Where the editor already marks a line — a diagnostic, or a breakpoint the user
set — that marking SHALL remain identifiable. A line's cost SHALL NOT hide
either.

The share shown SHALL belong to the buffer being displayed: switching to a
different buffer SHALL NOT show one buffer's costs against another's lines.

#### Scenario: The slow line is visible in the program

- **WHEN** a measured run has spent most of its time on one line
- **THEN** that line is marked as dominating the run, and lines that took an
  incidental share are distinguishable from it

#### Scenario: A line that never ran

- **WHEN** a measured run never executed a particular line
- **THEN** that line carries no cost marking

#### Scenario: Cost does not displace a diagnostic or a breakpoint

- **WHEN** a line carrying a diagnostic or a breakpoint also carries a measured
  cost
- **THEN** the diagnostic or breakpoint remains identifiable on that line

#### Scenario: Costs follow the buffer they were measured on

- **WHEN** the user switches to a buffer other than the one that was run
- **THEN** no line of the buffer now shown is marked with the other buffer's
  costs

### Requirement: Cost is charged to the line that ran, and says so

Time SHALL be charged to the BASIC line executing when it was spent. Time spent
inside a subroutine SHALL therefore be charged to the subroutine's own lines and
SHALL NOT be charged to the line that called it.

Because this is not the only conceivable accounting, the IDE SHALL state that
costs are charged this way where it presents a line's cost, so that a user
reading a program whose work is done in subroutines is not left to infer the
wrong thing from a cheap-looking call site.

Where the IDE can identify a program's named routines and the destinations its
program jumps to, it SHALL offer the run's cost summed over each of those, so
that a routine's total cost can be read without adding its lines up by hand.

#### Scenario: A subroutine's cost lands on the subroutine

- **WHEN** a program spends most of its time inside a subroutine called from a
  loop
- **THEN** the subroutine's lines carry that cost, and the calling line carries
  only the cost of making the call

#### Scenario: The accounting is disclosed

- **WHEN** the user reads a line's measured cost where the IDE presents it
- **THEN** that cost carries a statement that it excludes the routines the line
  calls

#### Scenario: Cost per routine

- **WHEN** the user asks for a measured program's cost by routine
- **THEN** each named routine and jump destination the IDE can identify is
  reported with the run's time summed across its lines

### Requirement: Memory use is reported across the run

Where the machine reports its own BASIC memory figures, the IDE SHALL report how
much memory the program was using over the course of the run, not only what it
is using now, and SHALL report the greatest amount it used at any point.

The account SHALL be positioned against the run's own elapsed machine time, so a
moment in the memory record can be related to the moment in the run it describes.

A run long enough to exceed what the IDE retains SHALL still report the greatest
amount used, and SHALL make clear that the record it shows does not cover the
whole run rather than presenting a partial record as complete.

#### Scenario: Memory rising over a run

- **WHEN** a program's memory use grows as it runs
- **THEN** the IDE reports that growth across the run, and the greatest amount
  used

#### Scenario: Memory reclaimed mid-run

- **WHEN** a running program's BASIC reclaims memory part-way through the run
- **THEN** the reported account shows the memory in use falling at that point in
  the run

#### Scenario: A run longer than the retained record

- **WHEN** a run lasts longer than the IDE retains a memory record for
- **THEN** the greatest amount used is still reported, and the account states
  that it does not cover the whole run

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

Charging memory to a line requires observing the program leave that line, which
a program whose loop occupies a single line never does. Where the run's memory
figure rose and none of it could be charged to a line, the IDE MAY instead
report an approximate breakdown, derived from the lines that were executing
while it rose, and SHALL mark that breakdown as approximate wherever it is
shown. An approximate breakdown SHALL NOT be combined with charged figures in
one reading: a reader given a mixture has no way to tell which figures were
measured, and a line that took nothing would be credited for the time it spent.

The IDE SHALL distinguish a run in which no memory figure was ever read from one
in which figures were read and no memory was taken. The first is the absence of
a measurement and the second is a measurement.

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
- **THEN** the IDE states that no memory was taken, rather than showing a blank
  reading or a ranking of zeroes

#### Scenario: A loop written on a single line

- **WHEN** a program takes memory in a loop that occupies one line, so the
  program is never observed leaving the line that takes it
- **THEN** the IDE reports an approximate breakdown derived from the lines
  executing while memory rose, and states that it is approximate

#### Scenario: An approximate breakdown is not mixed with charged figures

- **WHEN** the IDE reports an approximate breakdown
- **THEN** every figure in that reading is approximate, and no line carries a
  charged figure alongside them

#### Scenario: No memory figure was ever read

- **WHEN** a run is measured but the machine never yields a memory figure
- **THEN** the IDE says that no readings were taken, distinctly from saying that
  no memory was taken

### Requirement: A machine offers only the measurements it can make

The IDE SHALL derive what it reports from what the machine can actually
determine, and SHALL offer no figure a machine cannot produce.

A machine that cannot report the BASIC line it is executing SHALL yield no
per-line costs. A machine that cannot report its memory figures SHALL yield no
memory account. A machine able to do one but not the other SHALL yield that one.

Where a measurement is unavailable, the IDE SHALL say that the machine does not
report it, rather than showing zeroes, blanks, or figures carried over from a
different machine or an earlier run.

#### Scenario: A machine that cannot report its executing line

- **WHEN** the user runs a program on a machine that cannot report which BASIC
  line it is executing
- **THEN** no per-line costs are shown, and the IDE states that this machine
  does not report them

#### Scenario: A machine that reports lines but not memory

- **WHEN** the user runs a program on a machine that reports its executing line
  but not its memory figures
- **THEN** per-line costs are reported and the memory account is stated to be
  unavailable

#### Scenario: An unavailable figure is not shown as zero

- **WHEN** a machine cannot produce one of the measurements
- **THEN** that measurement is reported as unavailable rather than as a zero or
  an empty result

### Requirement: Measurements describe one run of one program

The measurements the IDE holds SHALL describe the most recent run. Starting a
new run SHALL discard the previous run's measurements rather than accumulating
across runs, so that a figure always describes a single execution.

Measurements SHALL NOT outlive the program they describe: changing the program
in a way that changes which lines exist SHALL discard measurements taken against
the old lines, rather than showing them against lines that no longer correspond.

#### Scenario: A new run replaces the previous measurements

- **WHEN** the user runs a program that has already been measured
- **THEN** the reported measurements describe the new run alone

#### Scenario: Measurements do not survive an edit that moves the lines

- **WHEN** the user edits the program so that its lines no longer correspond to
  the measured ones
- **THEN** the stale per-line costs are discarded rather than shown against the
  edited program

### Requirement: A program can be timed from start to finish

The user SHALL be able to time a program's run: the emulated machine time from
the moment the program starts running to the moment the timing ends.

The duration reported SHALL be the machine's own time on the same terms as every
other duration the IDE reports, so timing a program at real time and at a
multiple of real time SHALL give the same answer.

Time SHALL NOT accrue while execution is paused, so a user who leaves a paused
program to examine it SHALL NOT find that pause counted against the program.

#### Scenario: Timing a program that runs to completion

- **WHEN** the user times a program on a machine that can observe the program
  finishing
- **THEN** the duration reported is the emulated machine time the program took

#### Scenario: The speed multiplier does not change the timing

- **WHEN** the user times the same program at real time and at a multiple of
  real time
- **THEN** both timings report the same duration

#### Scenario: A pause is not counted

- **WHEN** a timed program pauses and the user leaves it paused before resuming
- **THEN** the time spent paused is not included in the duration

### Requirement: A timing states how it ended

Every duration the IDE reports for a timed run SHALL be accompanied by how that
timing ended: the program finished, the program stopped on an error, the program
was still running when the user stopped it, or execution paused.

A duration SHALL NOT be presented as the time a program took to finish unless
the program was observed to finish. Where the timing ended some other way, the
IDE SHALL say so wherever the duration is shown, so a duration that means "until
the user stopped it" is never read as a completion time.

#### Scenario: A program the user stopped

- **WHEN** the user stops a timed program that was still running
- **THEN** the duration is reported as time until the user stopped it, and not
  as the time the program takes

#### Scenario: A program that failed

- **WHEN** a timed program stops on an error
- **THEN** the timing ends and reports that the program errored, alongside the
  duration up to that point

#### Scenario: A program that never finishes

- **WHEN** the user times a program that keeps running indefinitely
- **THEN** the timing reports that the program was still running rather than
  waiting without result

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
  program finishing### Requirement: The interval between pauses can be timed

Where the machine supports line-level debugging, the IDE SHALL report the
emulated machine time elapsed between one pause of the run and the next, so a
stretch of a program can be timed without timing the whole of it.

The interval SHALL be measured between the moments execution actually pauses,
not between the moments breakpointed lines are reached, so that a breakpoint
which does not pause the run does not mark an interval.

Stepping the program a line at a time SHALL yield the interval for each step.

#### Scenario: Timing between two breakpoints

- **WHEN** a debugged run pauses at one breakpoint, is continued, and pauses at
  another
- **THEN** the emulated machine time between the two pauses is reported

#### Scenario: Continuing off a breakpointed line

- **WHEN** the user continues from a pause on a line that is itself
  breakpointed, and the run continues without pausing again immediately
- **THEN** no interval is marked at that line until the run actually pauses
  again

#### Scenario: Stepping a line at a time

- **WHEN** the user steps a debugged program line by line
- **THEN** each step reports the emulated machine time that step took
