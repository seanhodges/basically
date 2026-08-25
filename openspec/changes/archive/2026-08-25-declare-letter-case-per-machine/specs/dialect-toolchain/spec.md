## ADDED Requirements

### Requirement: Letter case is declared per machine

Letter case is not one fact about a machine but several, and the registered
machines disagree on each of them independently. Every registered machine SHALL
therefore declare, as facts about its ROM rather than as a shared rule:

- whether its character generator can draw lower case at all, and whether the
  lower case it has belongs to a second character set the machine switches to at
  run time rather than being always available;
- whether its ROM's own keyword scan accepts a lower-case spelling of a keyword;
- whether its ROM tells `A` from `a` in a variable name;
- what the machine's own text encoding does with a lower-case letter — folds it
  onto the upper-case character, or preserves it as its own.

The last of these SHALL be stated for each machine rather than inferred from the
first, because the two do not agree everywhere: a machine may have lower-case
shapes and still fold, where one stored character draws either case depending on
the set in force.

Whether a lower-case keyword is read as a keyword by the IDE SHALL follow both
the ROM's keyword scan and the machine's text encoding, since a machine whose
encoding folds never presents lower case to its ROM at all. Where a dialect
chooses to accept a spelling its ROM would refuse, so that a listing written in
lower case can be read, that leniency SHALL be declared rather than assumed.

#### Scenario: A machine whose encoding folds lower case

- **WHEN** a program on a machine whose text encoding has no lower-case
  characters stores a lower-case letter
- **THEN** it is stored as the upper-case character, and a lower-case keyword in
  that program is read as the keyword

#### Scenario: A machine whose encoding preserves lower case

- **WHEN** a program on a machine whose text encoding has lower-case characters
  stores a lower-case letter
- **THEN** it is stored as the lower-case character, and listing the program
  back returns the lower case it was written in

#### Scenario: A machine with a switchable character set

- **WHEN** the declared facts are read for a machine that carries its lower case
  in a second character set selected at run time
- **THEN** the machine is declared as having lower case, and as switching
  between the sets, rather than as having none

#### Scenario: A machine with lower-case shapes whose encoding still folds

- **WHEN** the declared facts are read for a machine that can draw lower case
  but whose stored characters do not distinguish the two cases
- **THEN** it is declared as having lower case and as folding it, and the two
  facts do not contradict one another

### Requirement: A lower-case keyword is reported where it will not run

Where a machine's text encoding preserves lower case and its ROM's keyword scan
compares characters rather than folding them, a keyword spelled in lower case is
not a keyword on that machine — it is a name, and the program will not do what
its author meant. The IDE SHALL report such a spelling, naming the upper-case
spelling the machine wants.

The report SHALL NOT prevent the program being built, run or exported: it says
what the machine will make of the program, and the author decides.

Where a dialect's own reading accepts such a spelling anyway, so that a listing
written in lower case can be opened and read, it SHALL still report it. Being
lenient about what can be opened is not a claim that the machine will run it.

Machines whose encoding folds lower case, or whose ROM accepts either case, SHALL
NOT report anything: on those machines a lower-case keyword is the keyword.

#### Scenario: A lower-case keyword on a machine that refuses it

- **WHEN** a program on a machine whose ROM matches keywords by character spells
  a command in lower case
- **THEN** the editor reports it and names the upper-case spelling, and the
  program can still be built, run and exported

#### Scenario: A lower-case keyword on a machine that folds

- **WHEN** a program on a machine whose text encoding folds lower case spells a
  command in lower case
- **THEN** nothing is reported, and the command is read as the keyword

#### Scenario: A dialect that reads a spelling its machine would refuse

- **WHEN** a listing spelled in lower case is opened on a machine whose ROM
  would refuse it, and the dialect reads it as the keyword anyway
- **THEN** the spelling is still reported, so the reader learns the machine will
  not run it as written
