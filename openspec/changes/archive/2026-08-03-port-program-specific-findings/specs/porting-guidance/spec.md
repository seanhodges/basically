## ADDED Requirements

### Requirement: The characters the target cannot represent are reported

A machine's character set covers only part of printable ASCII, and a character it has
no glyph for cannot appear anywhere in a program — not in a string, a comment or a
variable name. The comparison SHALL report, for the target machine, the printable
characters it cannot represent, so that a reader learns the restriction before writing
against it rather than from an error afterwards.

Where the reader's own program is at hand, this SHALL be narrowed to the characters
that program actually contains, so it names the work this port requires rather than the
machine's whole shortfall. Where there is no program to narrow to, the target's full
set SHALL be reported.

A machine that represents printable ASCII in full SHALL report nothing, rather than
reporting an empty list.

Control codes and graphics characters SHALL NOT be reported here; they are reported as
control codes, and reporting a block graphic among the characters to replace would
describe the same difference twice under two names.

#### Scenario: A program using a character the target lacks

- **WHEN** a user compares two machines with a program open that uses a character the
  target machine cannot represent
- **THEN** that character is reported as one the port must replace

#### Scenario: A program the target can represent in full

- **WHEN** the program uses only characters the target machine has
- **THEN** no characters are reported, and the section is absent rather than empty

#### Scenario: Reading the comparison with no program

- **WHEN** a user compares two machines with no program to narrow to
- **THEN** every printable character the target cannot represent is reported

#### Scenario: A target with no restriction

- **WHEN** the target machine represents printable ASCII in full
- **THEN** nothing is reported about characters, whatever the program contains

### Requirement: How the program's statement layout must change is reported

Machines differ in whether several statements fit on one line and in what separates
them. Where the reader's own program is at hand, the comparison SHALL report how that
program's statement layout must change: which of its lines carry more than one
statement, and whether each such line must be split into several lines or merely
re-separated with the target's own separator.

The program's lines SHALL be counted as the language being ported **from** reads them,
so a separator character used as ordinary text on the source machine is not mistaken
for a statement break.

Where the program has no line carrying more than one statement, or the two machines
separate statements alike, nothing SHALL be reported.

#### Scenario: Porting to a machine that takes one statement per line

- **WHEN** the program has lines carrying several statements and the target machine
  takes only one statement per line
- **THEN** the comparison reports how many of the program's lines must be split, and
  which

#### Scenario: Porting to a machine that separates statements differently

- **WHEN** the program has lines carrying several statements and the target machine
  separates statements with a different character
- **THEN** the comparison reports which lines are affected and what the separator
  becomes

#### Scenario: A program with nothing to restructure

- **WHEN** every line of the program carries a single statement
- **THEN** nothing is reported about statement layout, whatever the two machines allow

#### Scenario: The separator as ordinary text

- **WHEN** the machine being ported from has no statement separator, and the program
  uses that character as ordinary text
- **THEN** those lines are not reported as carrying several statements

### Requirement: Control codes that keep their spelling and change meaning are reported

Two machines can spell a control code alike and store different bytes for it, which
ports silently wrong: nothing in the program's text changes, and the program behaves
differently. The comparison SHALL report such codes as differences the port must
re-check, distinctly from the codes the target does not have at all, saying what the
code stores on each machine.

These SHALL be narrowed to the codes the open program uses, as the codes that must be
replaced already are.

#### Scenario: A code that means something else on the target

- **WHEN** the program uses a control code the target machine spells the same way but
  stores differently
- **THEN** the comparison reports it as a code to re-check, naming what it stores on
  each machine

#### Scenario: A code that survives unchanged

- **WHEN** the program uses a control code that both machines spell and store alike
- **THEN** it is not reported as a difference

## MODIFIED Requirements

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

### Requirement: The comparison narrows to the program the user has open

Where the comparison is shown inside the IDE, and the user's own program is therefore at hand, the
comparison SHALL report only the differences that program is subject to: the commands it must
rewrite, the commands it must rename, the commands whose usage differs, the same-word-different-
meaning warnings, the control codes it must replace, the control codes that keep their spelling and
change meaning, the characters the target cannot represent, and the lines whose statement layout
must change SHALL each be limited to the commands, codes, characters and lines the program actually
contains. A capability, a group of control codes, or a whole section
left with nothing to report SHALL be absent rather than empty.

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

#### Scenario: Reading the comparison outside the IDE

- **WHEN** a user opens the comparison on its own, outside the IDE
- **THEN** every difference is reported and no narrowing control is offered

#### Scenario: An empty program

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** every difference is reported, as it is for a reader with no program at all
