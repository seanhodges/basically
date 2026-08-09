## MODIFIED Requirements

### Requirement: Whether the program fits the target machine is reported

Machines differ in how much memory a BASIC program may occupy, by more than an
order of magnitude between some relatives, and a program that fits the machine it
was written for may not load at all on the machine it is going to. This is the one
failure a port can hit while requiring no other change whatever: two machines can
run the same BASIC, share every command, and differ only in room.

Where the reader's own program is at hand, the comparison SHALL therefore report
the size that program takes on the **target** machine against the program memory
that machine has free, and SHALL say whether it fits, is close to the limit, or
has no room. Both figures SHALL be reported, so that a reader told it does not fit
is also told by how much.

The size SHALL be measured as the target machine stores the program, not as the
source machine does: machines encode the same program text into different numbers
of bytes, so a size carried over from the machine being ported from would describe
the wrong machine.

Where the program uses something the target cannot express, the size SHALL still be
reported, measured from what the target can store and stated as a lower bound. What
the target cannot express is reported by the comparison's other findings and is not
itself a failure to fit.

A size known only as a lower bound SHALL NOT be reported as fitting, however far
under the machine's memory it falls: what could not be measured is precisely what
would add to it. It SHALL be reported as being at least that size. A lower bound
that already exceeds the machine's memory SHALL be reported as not fitting, that
conclusion being safe in the direction the doubt runs.

Where the target machine could store none of the program at all, nothing SHALL be
reported about fit.

The point at which the comparison calls the program close to the limit, and the
point at which it calls it too large, SHALL be the same points at which the editor
reports a program as close to or over its budget, so that one proportion of a
machine's memory means one thing wherever the user meets it.

Where the fit report calls the program close to the limit or over it, the
comparison MAY additionally report target-side measures that would make room —
each a fact pinned to the target machine, never an invitation to rewrite the
program. First among them is conditionally free memory: where the target holds
memory that hardware claims only for an optional feature, and the program's own
text proves the feature unused, the comparison SHALL report that memory with its
size and the condition that frees it, and SHALL pose the decision — place data
and machine code there, or shorten the program. Where the condition is not met,
or cannot be decided from the program's text, or the program is comfortably
inside the budget, nothing SHALL be reported about such memory: a measure the
program does not qualify for is not a measure, and a program under no pressure
has no use for one. Doubt SHALL run toward not reporting the memory, as the
lower-bound rule already runs it.

Where there is no program to size — the comparison read on its own, nothing open,
or a program that cannot be read — nothing SHALL be reported about fit.

#### Scenario: A program too large for the target

- **WHEN** a user compares two machines with a program open that would take more
  memory on the target machine than that machine has free
- **THEN** the comparison reports that the program will not fit, giving both the
  size it takes on the target and the memory that machine has free

#### Scenario: A program that fits with room to spare

- **WHEN** the program takes well under the target machine's free program memory
- **THEN** the comparison reports that it fits, giving both figures

#### Scenario: A program close to the target's limit

- **WHEN** the program takes most of the target machine's free program memory,
  without exceeding it
- **THEN** the comparison reports it as close to the limit, at the same proportion
  of the budget at which the editor reports a program as close to its own

#### Scenario: Two machines running the same BASIC with different memory

- **WHEN** the source and target machines run the same BASIC, so no command,
  control code or language rule differs between them, and the target has far less
  program memory
- **THEN** the comparison still reports that the program does not fit, rather than
  reporting a port with no work in it

#### Scenario: A machine whose relatives differ in memory

- **WHEN** the target machine's family includes relatives with different amounts of
  free program memory
- **THEN** the fit is reported against the selected machine's own memory

#### Scenario: A program the target cannot fully express

- **WHEN** the program uses commands or characters the target machine has no way to
  store
- **THEN** a size is still reported, measured from what the target can store and
  stated as a lower bound, rather than the fit being left unreported

#### Scenario: A lower bound that has not yet reached the limit

- **WHEN** the size is known only as a lower bound and falls under the target
  machine's free program memory
- **THEN** it is reported as the program being at least that size, and is not
  reported as fitting

#### Scenario: A lower bound that already exceeds the limit

- **WHEN** the size is known only as a lower bound and already exceeds the target
  machine's free program memory
- **THEN** it is reported as not fitting, the doubt running only towards a larger
  program

#### Scenario: A program the target can store none of

- **WHEN** the target machine could store no part of the program
- **THEN** nothing is reported about fit

#### Scenario: A pressed program that stays in text mode

- **WHEN** the fit report calls the program close to the target's limit or over
  it, the target holds memory claimed only by a graphics feature, and every
  screen mode the program selects leaves that feature unused
- **THEN** the comparison reports that memory with its size and the condition
  that frees it, and poses the decision between placing data there and
  shortening the program

#### Scenario: A pressed program that uses the feature

- **WHEN** the fit report calls the program close to the limit or over it, and
  the program selects a mode, computes a mode, or writes an address that means
  the feature's memory cannot be proven free
- **THEN** nothing is reported about that memory

#### Scenario: A program under no fit pressure

- **WHEN** the program fits the target with room to spare
- **THEN** nothing is reported about conditionally free memory, however clearly
  the program would qualify

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or inside the IDE with nothing
  open or with a program that cannot be read
- **THEN** nothing is reported about whether the program fits, and asking to see
  every difference does not produce a fit report
