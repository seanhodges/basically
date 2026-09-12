# machine-debug Specification

## Purpose

Stop a BASIC program where the caller wants it and look at it there. A caller
holding a machine can name the lines a program is to stop before, start a run
that is going to stop, step a stopped program on a line at a time, continue it
to its next stop or its end, and ask where it is — without the machine running
any differently for the debugger being there, and with a machine that cannot
say which line it is executing saying so rather than pretending.

## Requirements

### Requirement: A caller holding a machine can say where a program is to stop

A caller that holds a machine SHALL be able to name the BASIC line numbers a
program is to stop before, and SHALL be told which lines are in force
afterwards, so that a caller never has to remember what it asked for.

Naming a set of lines SHALL replace whatever was in force rather than adding to
it, and naming none SHALL leave the program stopping nowhere. A line number no
line of the program carries SHALL be accepted and simply never reached, because
a caller may set a breakpoint on a line it is about to write.

A caller that holds no machine SHALL be told so and told how to start one, on the
same terms as any other request that needs a machine before one is up.

#### Scenario: Naming the lines to stop on

- **WHEN** a caller holding a machine names the lines a program is to stop before
- **THEN** those lines are in force and the caller is told which they are

#### Scenario: Replacing the lines

- **WHEN** a caller names a second set of lines while a first set is in force
- **THEN** only the second set is in force

#### Scenario: Clearing them

- **WHEN** a caller names no lines at all
- **THEN** the program stops nowhere, and continuing runs it to its end

#### Scenario: Asking before a machine is up

- **WHEN** a caller names the lines to stop on while holding no machine
- **THEN** it is told that no machine is up and how to start one

### Requirement: A run can be told where to stop, and says that it stopped

A run SHALL be able to be told the BASIC line numbers to stop before, so that a
program can be stopped part-way through the first time it is run. Without this a
caller could only ask for a stop after a run, by which time the program it wanted
to stop has already finished.

A run that stopped SHALL report that it stopped and which line it stopped before,
distinguishably from a run that reached the end of its program and from a run
that used up the frames it was given. The machine SHALL be left where the stop
left it, so that the caller can go on to look at it, measure it, step it or
continue it.

#### Scenario: Running a program that is going to stop

- **WHEN** a caller runs a program having said it is to stop before a line the
  program reaches
- **THEN** the run reports that it stopped before that line, and the machine is
  left there

#### Scenario: A run that stops is not a run that ended

- **WHEN** a caller runs a program that stops before a line, and another that
  runs to its end
- **THEN** the two outcomes are distinguishable without reading any prose

#### Scenario: A stop that is never reached

- **WHEN** a caller runs a program having said it is to stop before a line the
  program never executes
- **THEN** the run ends the way the same run would have ended with no stop asked
  for

### Requirement: A stopped program can be stepped a line at a time

A caller SHALL be able to run a stopped program on to the next BASIC line and be
told which line that is. Stepping SHALL run the program until the line about to
be executed differs from the one it was stopped at, so that a line the program
dwells on is one step and not many.

Each step SHALL report what it cost in the machine's own emulated time, so that a
stretch of a program can be timed a line at a time without timing the whole of
it — the same figure the IDE reports for a step.

A step that runs out of the frames it was given without reaching another line
SHALL say so as an ordinary outcome, leaving the machine where it got to. A step
that ends the program SHALL say the program ended rather than naming a line it
never reached.

#### Scenario: Stepping to the next line

- **WHEN** a caller steps a program stopped before a line
- **THEN** the program runs on to the next BASIC line and the caller is told
  which line that is

#### Scenario: What a step cost

- **WHEN** a caller steps a stopped program
- **THEN** the emulated machine time that step took is reported

#### Scenario: A line the program dwells on

- **WHEN** a caller steps a program stopped before a line that takes longer than
  one display frame to execute
- **THEN** that is one step, ending at the next line rather than partway through

#### Scenario: Stepping off the end of a program

- **WHEN** a caller steps a program whose last line is the one it is stopped at
- **THEN** it is reported that the program ended, and no line is named as the one
  it is now stopped before

### Requirement: A stopped program can be continued to its next stop or its end

A caller SHALL be able to run a stopped program on until it stops again or until
it ends, and SHALL be told which of those happened and, where it stopped, which
line it stopped before.

Continuing from a line that is itself one of the lines to stop on SHALL NOT stop
again immediately: the program SHALL run on until execution has left that line
and reached a line to stop on afterwards. Otherwise a caller could never get past
the first stop.

Continuing SHALL be bounded by the frames the caller gives it, and exhausting
them SHALL be an ordinary outcome saying that neither a stop nor the end of the
program was reached — a program that loops forever is an ordinary BASIC program,
not a fault.

#### Scenario: Continuing to the next stop

- **WHEN** a caller continues a stopped program that reaches another line it is
  to stop before
- **THEN** the program stops there and the caller is told which line it is

#### Scenario: Continuing to the end

- **WHEN** a caller continues a stopped program that reaches no further line it
  is to stop before
- **THEN** the program runs to its end and the caller is told that it ended

#### Scenario: Continuing off a line that is itself a stop

- **WHEN** a caller continues a program stopped before a line that is one of the
  lines to stop on
- **THEN** the program runs on rather than stopping again at once

#### Scenario: A program that will not finish

- **WHEN** a caller continues a program that neither stops again nor ends within
  the frames it was given
- **THEN** it is reported that neither happened, the machine is left running, and
  this is not reported as a fault

### Requirement: A caller can ask where a held machine is

A caller SHALL be able to ask, of the machine it holds, which line a stopped
program is stopped before, whether a program is running at all, which lines are
in force to stop on, and whether this machine can be stepped — without changing
anything about the machine.

This SHALL be answerable by a caller that has just been handed a machine and
remembers nothing, so that where a program is need never be inferred from what
was asked of it earlier.

Where no line can be determined — nothing is running, or the machine is sitting
at its prompt — that SHALL be said rather than reported as a line.

#### Scenario: Asking where a stopped program is

- **WHEN** a caller asks about a machine holding a program stopped before a line
- **THEN** it is told that line, that a program is running, and which lines are
  in force to stop on

#### Scenario: Asking about a machine running nothing

- **WHEN** a caller asks about a machine whose program has ended
- **THEN** it is told that no program is running, and no line is reported as the
  line it is stopped before

#### Scenario: Asking does not change the machine

- **WHEN** a caller asks where a held machine is, twice, with nothing in between
- **THEN** the same answer is given both times and the machine has not advanced

### Requirement: A machine that cannot be stepped says so rather than failing

Not every machine can say which BASIC line it is executing, and one that cannot
SHALL NOT be asked to pretend. Asking such a machine to stop somewhere, to step
or to continue SHALL be answered by saying that this machine cannot be stepped,
naming what can still be done with it, rather than by failing or by accepting a
stop that would never happen.

Describing a machine SHALL say whether it can be stepped, so that a caller can
tell before it tries. Whether a machine can be stepped SHALL be read from what
that machine declares, never from a list maintained beside it.

#### Scenario: Asking a machine that cannot be stepped to stop

- **WHEN** a caller asks a machine that cannot say which BASIC line it is
  executing to stop before a line
- **THEN** it is told that this machine cannot be stepped and what it can still
  do, and no stop is set

#### Scenario: Telling before trying

- **WHEN** a caller asks about a machine
- **THEN** the description says whether that machine can be stepped

### Requirement: Stopping a program changes nothing about how it runs

A program on a machine that can be stepped SHALL run exactly as it would on a
machine that cannot: the same emulated time SHALL pass, the same measurements
SHALL be produced, and the program SHALL do the same thing. The only difference
stopping may make is that the program stops where the caller asked it to.

This SHALL hold whether or not any line has been named to stop on, so that a
caller pays nothing for the debugger being there. A measurement of a program that
was stopped and continued SHALL cover the time the program was executing and
SHALL NOT include the time it spent stopped, because a stopped machine advances
not at all.

#### Scenario: A program run with nothing named to stop on

- **WHEN** a caller runs a program on a machine that can be stepped, having named
  no line to stop on
- **THEN** the run takes the same emulated time and reports the same measurements
  as the same run on a machine that cannot be stepped

#### Scenario: A long pause between requests

- **WHEN** a caller stops a program, waits a long time, and then continues it
- **THEN** the program's own measurements are the same as if the two requests had
  come one after another

### Requirement: A machine being played is not a machine anything can stop

While a machine is being played it is being driven by a person on its own clock,
so it SHALL NOT be a machine anything can be asked to stop, step or continue.
Those requests SHALL be refused, saying that the machine is being played and how
to stop playing, on the same terms as the requests that measure it.

Asking where a played machine is SHALL be answered, and SHALL be understood to
have caught a machine that is moving: two answers MAY differ without that being
reported as a fault.

When the play channel ends, the machine SHALL again be one that can be stopped,
stepped and continued.

#### Scenario: Asking a played machine to stop

- **WHEN** the caller holding a machine that is being played asks it to stop
  before a line
- **THEN** it is refused, told the machine is being played, and told how to stop
  playing

#### Scenario: Asking where a played machine is

- **WHEN** the caller asks where a machine that is being played is
- **THEN** it is answered, of a machine that is moving

#### Scenario: After the channel ends

- **WHEN** a play channel ends and the caller still holds its machine
- **THEN** asking it to stop before a line is answered again
