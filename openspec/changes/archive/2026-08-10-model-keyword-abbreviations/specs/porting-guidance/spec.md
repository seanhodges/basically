## ADDED Requirements

### Requirement: Abbreviated spellings are resolved and reported

Machines that let a program spell keywords short — a dotted prefix, a shifted
letter, a symbol standing for a whole command — were typed that way, and
archive listings carry those spellings. A spelling is part of the program's
text: a target that does not accept it will not read the line, and a target
that reads it as something else changes the program silently. The keyword the
spelling stands for is meanwhile real work the port must account for.

The comparison SHALL read abbreviated and symbol spellings as the machine
being ported **from** reads them, so a program that prints only with an
abbreviation is a program that prints: the resolved commands SHALL take part
in the narrowing exactly as commands spelled in full do.

Where the reader's own program contains spellings the target machine does not
accept, the comparison SHALL report each with the command it stands for, as
mechanical work to expand, among the renames rather than among the rewrites —
the command survives; only its spelling changes. A spelling the target reads
as the same command SHALL NOT be reported: there is no work in it.

Where the target machine gives one of the program's spellings a different
meaning of its own, the comparison SHALL warn that the unexpanded spelling
does not fail on the target but changes meaning, in the same finding, since
the expansion is what removes the trap.

Where the target machine keeps short spellings in the stored program, so that
abbreviating genuinely shrinks it, and the fit report has the program close to
the limit or over it, the comparison SHALL report the target's own short
spellings among the measures that would make room, posing the decision — 
abbreviate once the port runs, or shorten the program another way. On a
machine whose stored program is the same size however keywords are spelled,
no such measure SHALL ever be reported.

Where there is no program, nothing SHALL be reported about spellings: which
abbreviations a program uses is a fact about a program, not about a pair of
machines.

#### Scenario: A dotted program moving to a machine without dot entry

- **WHEN** the open program spells commands with the source machine's dot
  abbreviations and the target machine accepts no such spelling
- **THEN** the comparison reports each spelling with the command it stands
  for, as expansions among the mechanical work

#### Scenario: A symbol the target reads as its own operator

- **WHEN** the open program uses a symbol spelling for a command, and the
  target machine reads that symbol as an operator of its own
- **THEN** the comparison warns that the unexpanded symbol does not fail on
  the target but changes meaning

#### Scenario: A spelling both machines read alike

- **WHEN** the open program uses a spelling the target machine reads as the
  same command the source does
- **THEN** nothing is reported about that spelling

#### Scenario: An abbreviated program is narrowed correctly

- **WHEN** the open program uses a command only through an abbreviated
  spelling, and the target lacks that command
- **THEN** the command is reported among the commands the program uses that
  the target does not have, exactly as if it were spelled in full

#### Scenario: A pressed port to a machine whose spellings save room

- **WHEN** the fit report has the program close to the target's limit or over
  it, and the target machine stores short spellings as fewer bytes
- **THEN** the comparison reports the target's short spellings among the
  measures that would make room, with the decision posed

#### Scenario: A machine where spelling changes nothing

- **WHEN** the target machine stores a program at the same size however its
  keywords are spelled
- **THEN** short spellings are never reported as a measure, whatever the fit

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about abbreviated spellings
