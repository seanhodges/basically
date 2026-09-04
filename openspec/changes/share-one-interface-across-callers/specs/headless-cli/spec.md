## ADDED Requirements

### Requirement: The command line offers what the assistant offers

Every operation the assistant can perform on a program or a machine SHALL be
reachable from the command line, and every operation the command line offers
SHALL be reachable by the assistant. Neither caller SHALL gain a capability the
other silently lacks.

Parity is of capability, not of invocation. How a caller reaches an operation
MAY differ, because their circumstances differ: an invocation of the command
line holds no machine between runs, so what the assistant asks of a machine it
is holding, the command line asks of a run — as an option on that run or as an
action within it. What SHALL be equal is what can be asked, not how it is
spelled.

Where a caller deliberately lacks an operation, that absence SHALL be declared
together with the reason for it, so that an asymmetry is a decision on record
rather than something discovered by trying. A declared absence SHALL stop being
declared once it stops being true, so the record cannot decay into a list of
things nobody rechecked.

#### Scenario: An operation one caller gains

- **WHEN** an operation becomes available to the assistant
- **THEN** the same capability is reachable from the command line, whether as an
  operation of its own, as an option on running a program, or as an action
  within a run

#### Scenario: An operation the other caller gains

- **WHEN** an operation becomes available on the command line
- **THEN** the same capability is available to the assistant

#### Scenario: An asymmetry that is intended

- **WHEN** an operation is deliberately not offered to one of the callers
- **THEN** that absence is declared, and the reason for it is stated

#### Scenario: An asymmetry that stops being true

- **WHEN** an operation previously declared unavailable to a caller becomes
  available to it
- **THEN** it is no longer declared as unavailable

### Requirement: A run can be measured from the command line

Where a run's time and memory went SHALL be reportable outside the browser, on
the same terms the IDE reports it: the costliest lines of the program as shares
of the run, those shares summed over the program's routines, and what the run
did to the machine's BASIC memory. How long a run took SHALL be reportable
alongside how that run ended, because a duration whose ending is unknown says
nothing — the seconds a program ran before it was stopped are not the time it
takes. What a variable holds at the end of a run SHALL be reportable in the same
way.

Every figure SHALL be in the emulated machine's own terms, so what is reported
does not depend on the computer the run happened on or on how fast it was
emulated.

A machine that cannot report which line it is executing, cannot account for its
memory, or cannot report its variables SHALL say so plainly rather than
reporting nothing, since nothing reads as a program that took no time, used no
memory, or held no variables.

#### Scenario: Asking where a run's time went

- **WHEN** a program is run from the command line and its measurements are asked
  for
- **THEN** the costliest lines are reported as shares of the run, summed over
  its routines as well

#### Scenario: Asking how long a run took

- **WHEN** a run's timing is asked for
- **THEN** the duration is reported in the machine's own time, together with how
  that run ended

#### Scenario: A machine that cannot be measured

- **WHEN** measurements are asked of a machine that cannot report which line it
  is executing
- **THEN** it is stated that runs on that machine are not measured, rather than
  an empty measurement being reported

#### Scenario: The same run measured on a faster computer

- **WHEN** the same program is run on computers of differing speed, or at
  differing emulation speeds
- **THEN** the measurements reported are the same

### Requirement: Every action a schedule accepts is described to every caller

The actions a schedule of input accepts SHALL be described identically to
whoever writes one. An action the schedule accepts but describes to nobody SHALL
NOT exist, and neither SHALL an action described to one caller and refused when
the other writes it — including how one action is separated from the next.

A caller that writes an action it was told about SHALL have it carried out
rather than refused.

#### Scenario: An action the schedule accepts

- **WHEN** a schedule accepts an action
- **THEN** that action is described to every caller that may write one

#### Scenario: A schedule written by one caller, read for the other

- **WHEN** a schedule written for one caller is given to the other, separators
  and all
- **THEN** it means the same thing and is carried out the same way
