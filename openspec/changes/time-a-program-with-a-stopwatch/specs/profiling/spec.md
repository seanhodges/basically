## ADDED Requirements

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

### Requirement: A machine that cannot observe a finish says so

Where the machine cannot determine whether a BASIC program is still running, a
timing SHALL NOT end by itself. It SHALL end when the user stops the run or when
execution pauses, and SHALL report which of those ended it.

The IDE SHALL make clear, on such a machine, that it cannot observe the program
finishing — rather than reporting a finish it did not observe, or leaving a
timing running with no explanation of why it has not ended.

#### Scenario: Timing on a machine that cannot observe a finish

- **WHEN** the user times a program on a machine that cannot determine whether a
  program is still running
- **THEN** they are told the machine cannot observe the program finishing, and
  the timing ends when they stop the run or execution pauses

#### Scenario: The ending is never overstated

- **WHEN** a timing ends on a machine that cannot observe a finish
- **THEN** the reported ending is the user stopping it or execution pausing, and
  never the program finishing

### Requirement: The interval between pauses can be timed

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
