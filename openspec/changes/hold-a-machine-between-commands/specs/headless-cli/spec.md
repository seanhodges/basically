## MODIFIED Requirements

### Requirement: Every caller of this toolchain offers what the others offer

Every operation any caller of this toolchain can perform on a program or a
machine SHALL be reachable from every other caller. No caller SHALL gain a
capability another silently lacks.

Parity is of capability, not of invocation. How a caller reaches an operation
MAY differ, because their circumstances differ. Where a caller can hold a
machine between one request and the next, what is asked of that machine SHALL be
reachable as an operation in its own right; where it cannot, the same capability
SHALL be reachable as an option on a run or as an action within one. A caller
that gains the ability to hold a machine SHALL gain those operations, and SHALL
keep offering the one-shot spelling too, so that what was written against it
goes on working. What SHALL be equal is what can be asked, not how it is spelled.

Where a caller deliberately lacks an operation, that absence SHALL be declared
together with the reason for it, so that an asymmetry is a decision on record
rather than something discovered by trying. A declared absence SHALL stop being
declared once it stops being true, so the record cannot decay into a list of
things nobody rechecked.

A reason SHALL be particular to the caller it is claimed of. An absence which
holds because of the circumstances one caller works in SHALL NOT be carried over
to a caller those circumstances do not describe, so that adding a caller widens
what is offered rather than inheriting what was withheld.

A host that serves a caller SHALL NOT itself be a caller: it offers no operation
of its own and declares no absence of its own, and every operation reaches it
only as one of the callers it serves.

#### Scenario: An operation one caller gains

- **WHEN** an operation becomes available to one caller
- **THEN** the same capability is reachable from every other caller, whether as
  an operation of its own, as an option on running a program, or as an action
  within a run

#### Scenario: A caller that is added

- **WHEN** a new caller of the toolchain is added
- **THEN** every operation is reachable from it, or is declared as one it
  deliberately lacks, with the reason stated

#### Scenario: An absence that does not travel

- **WHEN** an operation is declared absent from one caller, and another caller is
  added whose circumstances that reason does not describe
- **THEN** the operation is reachable from the new caller, and the existing
  absence stands only where its reason holds

#### Scenario: An asymmetry that is intended

- **WHEN** an operation is deliberately not offered to one of the callers
- **THEN** that absence is declared, and the reason for it is stated

#### Scenario: An asymmetry that stops being true

- **WHEN** an operation previously declared unavailable to a caller becomes
  available to it
- **THEN** it is no longer declared as unavailable

#### Scenario: A caller that gains a machine it can hold

- **WHEN** a caller that could hold no machine between requests becomes able to
- **THEN** every operation that acts on a machine is reachable from it as an
  operation of its own, and the option that spelled the same capability on a
  single run still works

#### Scenario: A host is not a surface

- **WHEN** the toolchain is served to its callers from a shared host
- **THEN** the host offers no operation of its own and declares no absence of its
  own, and parity is judged of the callers it serves

## ADDED Requirements

### Requirement: The command line can hold a machine between commands

The command line SHALL be able to leave the machine a run booted still running
when the command that started it has ended, and a later command SHALL be able to
act on that machine. What one command does to the machine SHALL be what the next
command sees.

The user SHALL be able to say that a run is to leave its machine up, to ask which
machine is being held, and to let a held machine go. A machine SHALL be let go
when the user says so, and SHALL NOT be left running indefinitely with nothing
attending to it.

The machine SHALL advance only when a command asks it to. A command that acts on
the machine SHALL spend the time it needs; a command that only reads the machine
SHALL spend none, so that reading the screen never changes it. Every measurement
SHALL be in the emulated machine's own time and SHALL NOT vary with how long the
user took between commands.

A command that needs a machine when none is being held SHALL say so and say how
to start one, rather than failing without explanation.

#### Scenario: Acting and then looking

- **WHEN** the user runs a program that waits at a prompt so that its machine is
  left up, presses a key in a later command, and reads the screen in a third
- **THEN** the screen read is the one that keypress left, not the one the program
  started at

#### Scenario: Reading without disturbing

- **WHEN** the user reads a held machine's screen twice with nothing in between
- **THEN** the same screen is reported both times

#### Scenario: A pause between commands

- **WHEN** a long time passes between two commands acting on a held machine
- **THEN** the machine is where the earlier command left it, and the run's
  measurements are the same as if the commands had come one after another

#### Scenario: Letting a machine go

- **WHEN** the user asks for the held machine to be let go
- **THEN** it is let go, and a later command reports that no machine is being
  held

#### Scenario: Acting before a machine is up

- **WHEN** the user asks for something that needs a machine while none is held
- **THEN** it is reported that no machine is being held and how to start one

### Requirement: A run that holds no machine still works as it did

A run that is not asked to leave its machine up SHALL behave exactly as it does
when no machine can be held: it boots, reports, and lets the machine go when it
ends. Every option that asks a single run to drive, measure or picture a machine
SHALL keep working and SHALL keep meaning what it means today, so that what a
user or a script has already written goes on working unchanged.

#### Scenario: A one-shot run

- **WHEN** the user runs a program without asking for its machine to be kept
- **THEN** the run reports what it reports today and leaves no machine held
  afterwards

#### Scenario: A schedule on a single run

- **WHEN** the user runs a program with a schedule of keys, asking for the
  screen, a picture and the run's measurements, without asking for its machine to
  be kept
- **THEN** each is reported as it is today, and no machine is left held
