## ADDED Requirements

### Requirement: Type markers the target does not have are reported

A variable's type marker is a promise about what the variable holds — integer,
single precision, double precision — and machines differ in which markers they
recognise. A program moving to a machine without one of its markers can fail
two ways, neither of which stops it tokenizing: the marker may be accepted in
the program's text and rejected the moment the line runs, or the type it named
may quietly cease to exist, so values keep flowing with less precision than the
program was written against.

Where the reader's own program is at hand and its variables carry a type marker
the target machine's naming rule does not recognise, the comparison SHALL
report each such marker with what it meant and the names that carry it, and
SHALL say the type must be given up along with the marker's spelling — not only
that the names change.

Where the target machine accepts the marker's spelling and fails when the line
runs, the comparison SHALL warn in exactly those terms, since a port that loads
cleanly and fails later is worse than one that fails at once. Where the marker
named a precision the target does not hold, the comparison SHALL say the values
lose precision silently and that arithmetic depending on the extra digits needs
checking.

Markers the program never uses SHALL NOT be reported, and a marker every
machine shares SHALL never be reported. Where there is no program, nothing
SHALL be reported: which markers a program leans on is a fact about a program,
not about a pair of machines.

#### Scenario: An integer marker the target rejects at run time

- **WHEN** the open program's variables carry an integer type marker, and the
  target machine accepts that spelling but fails when the line runs
- **THEN** the comparison reports the marker, the names carrying it, and that
  the failure comes at run time rather than at entry

#### Scenario: A precision the target does not hold

- **WHEN** the open program's variables carry a double-precision marker and the
  target machine holds single precision only
- **THEN** the comparison reports that those values lose precision silently,
  and that arithmetic depending on the extra digits must be checked

#### Scenario: A marker the program never uses

- **WHEN** the target machine lacks a type marker the source machine has, but
  no variable in the open program carries it
- **THEN** nothing is reported about that marker

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about type markers

## MODIFIED Requirements

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each machine has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

Where the target machine has no fractions and the reader's own program is at hand, the comparison
SHALL additionally report whether that program performs arithmetic the target would truncate — a
division, or a fractional value — so that a reader is told which of their calculations must be
rescaled rather than only that the machine cannot hold fractions. Where the program performs no such
arithmetic, or the target has fractions, nothing SHALL be reported beyond the difference itself.

Where the target machine's main number path is integer-only but the machine offers real numbers
through a separate system of its own — a floating-point extension with its own variables — the
truncation report SHALL pose the choice rather than choose: fractions the program depends on belong
in that system, fractions incidental to it are rescaled. Which the program's fractions are is not
decidable from its text, and the comparison SHALL NOT silently assume either answer.

Where both machines are integer-only and the target holds a narrower range of values than the
source, the comparison SHALL report both ranges whenever the reader's own program is at hand, so
that arithmetic written against the wider range is checked against the narrower one. Values in the
program's own text that the target cannot hold SHALL be named, and the report SHALL pose the
decision the named values force: rescale them to fit, or restructure the arithmetic so its results
stay inside the range. Where the target's range is at least the source's, or either machine has
fractions, nothing SHALL be reported about integer ranges beyond the difference itself.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target machine that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

#### Scenario: A program that divides, ported to an integer-only machine

- **WHEN** the target machine has no fractions and the open program divides or carries a fractional
  value
- **THEN** the comparison reports that this arithmetic is truncated on the target and must be
  rescaled, naming the range the target holds

#### Scenario: A program with no fractional arithmetic

- **WHEN** the target machine has no fractions and the open program performs no division and carries
  no fractional value
- **THEN** the difference in number handling is still reported and nothing is reported about the
  program's arithmetic

#### Scenario: A target that has fractions

- **WHEN** the target machine has floating point
- **THEN** nothing is reported about the program's arithmetic being truncated

#### Scenario: A target whose reals live in a separate system

- **WHEN** the target machine's main number path is integer-only, the machine offers reals through
  a separate system of its own, and the open program divides or carries a fractional value
- **THEN** the truncation report poses the choice — essential fractions into that system,
  incidental ones rescaled — rather than advising rescaling alone

#### Scenario: A 32-bit integer program moving to a 16-bit integer machine

- **WHEN** both machines are integer-only, the target holds a narrower range, and the open
  program's text carries a value beyond the target's range
- **THEN** the comparison reports both ranges, names that value as one the target cannot hold, and
  poses the decision between rescaling and restructuring

#### Scenario: A narrower target and a program whose values all fit

- **WHEN** both machines are integer-only, the target holds a narrower range, and no value in the
  open program's text exceeds it
- **THEN** the comparison still reports both ranges with the decision to check the arithmetic,
  since results can exceed a range no literal exceeds

#### Scenario: Integer ranges with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** each machine's number handling is reported among the language differences, and nothing
  is reported about values or arithmetic to check

### Requirement: Carrying out the port targets the machine chosen

Where the comparison offers to carry the port out, it SHALL convert the program
for the machine the user selected as the target.

Carrying the port out SHALL additionally hand the assistant what the comparison
worked out for this program: the machine being ported from and the BASIC it runs,
the language rules that differ between the two machines, the commands the program uses
that the target lacks together with any advice written for them, the commands to
rename, the commands whose behaviour differs, the commands that mean something
different under the same name, the control codes that must change, the control codes
that keep their spelling and change meaning, the characters the target cannot
represent, how the program's statement layout must change, and the guidance specific to
this pair and this target.

What is handed over SHALL be narrowed to the program being converted, as the
comparison's own report is, so it describes this port rather than the two
machines in general. The language rules are the exception, and SHALL be handed over as
the rules that *differ* between the two machines: a rule holds whatever commands a
program uses, so narrowing it would drop the rule the port most needs.

Where a finding poses a decision — a choice the comparison cannot settle from
the program's text — the decision SHALL be handed over with the finding, and
the assistant SHALL be told to settle each one from what the program itself
does. Where the program's behaviour cannot settle it either, the assistant
SHALL say which reading it chose, so the choice is visible rather than buried
in the converted code.

#### Scenario: Converting to a specific machine

- **WHEN** the user selects a machine as the target and asks for the port to be
  carried out
- **THEN** the program is converted for that machine, and the IDE continues on
  that machine

#### Scenario: Converting to a machine that shares a BASIC with a relative

- **WHEN** the user selects a machine whose BASIC a close relative also runs,
  and asks for the port to be carried out
- **THEN** the program is converted for the machine selected, not for its
  relative

#### Scenario: The port is carried out with the differences reported

- **WHEN** the user asks for the port to be carried out
- **THEN** the assistant is given the differences the comparison reported for
  this program, rather than only the name of the target machine

#### Scenario: Differences the program does not touch

- **WHEN** the comparison has reported differences for commands the program does
  not use
- **THEN** those are not handed over, because they are not work this port
  requires

#### Scenario: A language rule the program must be restructured for

- **WHEN** the two machines differ in how a line is laid out, how assignment is
  written, or how numbers are held
- **THEN** the assistant is given that difference, and where the program itself is
  subject to it, the lines that must change

#### Scenario: A posed decision is settled from the program

- **WHEN** a finding handed to the assistant poses a decision, and the program's
  own behaviour settles it
- **THEN** the assistant carries the port out under that reading, without asking

#### Scenario: A posed decision the program cannot settle

- **WHEN** a finding handed to the assistant poses a decision the program's
  behaviour does not settle
- **THEN** the assistant says which reading it chose, alongside the converted
  program
