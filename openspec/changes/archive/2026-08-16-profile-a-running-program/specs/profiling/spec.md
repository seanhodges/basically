## ADDED Requirements

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
