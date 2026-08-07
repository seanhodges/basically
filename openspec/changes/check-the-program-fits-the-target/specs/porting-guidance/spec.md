## ADDED Requirements

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

The point at which the comparison calls the program close to the limit, and the
point at which it calls it too large, SHALL be the same points at which the editor
reports a program as close to or over its budget, so that one proportion of a
machine's memory means one thing wherever the user meets it.

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

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or inside the IDE with nothing
  open or with a program that cannot be read
- **THEN** nothing is reported about whether the program fits, and asking to see
  every difference does not produce a fit report

## MODIFIED Requirements

### Requirement: The comparison narrows to the program the user has open

Where the comparison is shown inside the IDE, and the user's own program is therefore at hand, the
comparison SHALL report only the differences that program is subject to: the commands it must
rewrite, the commands it must rename, the commands whose usage differs, the same-word-different-
meaning warnings, the control codes it must replace, the control codes that keep their spelling and
change meaning, the characters the target cannot represent, and the lines whose statement layout
must change SHALL each be limited to the commands, codes, characters and lines the program actually
contains. A capability, a group of control codes, or a whole section
left with nothing to report SHALL be absent rather than empty.

Some findings exist only because there is a program to make them about — how that
program's statement layout must change, and whether it fits the target machine's
program memory. Where there is no program, those findings SHALL be absent rather
than reported in general terms, and the control that reveals every difference SHALL
NOT produce them: there is no unnarrowed form of a statement about the reader's own
program.

What the target machine adds, the language and hardware differences, and the guidance prose SHALL
NOT be narrowed: the first is already about what the program did not use, and the other two state
rules that hold for any program whatever commands it uses.

Where the comparison is read on its own, outside the IDE, no narrowing SHALL take place and every
difference SHALL be reported — narrowing is an extra for the user who has a program, never a
condition of the guidance.

#### Scenario: Reading the comparison with a program open

- **WHEN** a user reads the comparison inside the IDE with a program open
- **THEN** the commands to rewrite, rename and re-check, the same-word-different-meaning warnings,
  the control codes to replace and to re-check, and the characters to replace name only commands,
  codes and characters the program contains

#### Scenario: A capability the program does not draw on

- **WHEN** the port would lose commands from a capability, but the program uses none of them
- **THEN** that capability is not reported among the ones the port must deal with

#### Scenario: What is never narrowed

- **WHEN** the comparison is narrowed to the open program
- **THEN** the language and hardware differences, the guidance prose, and what the target machine
  adds are reported in full, exactly as they are without a program

#### Scenario: A finding that needs a program

- **WHEN** a user asks to see every difference for a pair, with no program open
- **THEN** the findings that describe the reader's own program — its statement
  layout and whether it fits the target — remain absent

#### Scenario: Reading the comparison outside the IDE

- **WHEN** a user opens the comparison on its own, outside the IDE
- **THEN** every difference is reported and no narrowing control is offered

#### Scenario: An empty program

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** every difference is reported, as it is for a reader with no program at all
