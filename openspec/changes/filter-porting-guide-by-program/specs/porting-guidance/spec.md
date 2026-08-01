## ADDED Requirements

### Requirement: The comparison narrows to the program the user has open

Where the comparison is shown inside the IDE, and the user's own program is therefore at hand, the
comparison SHALL report only the differences that program is subject to: the commands it must
rewrite, the commands it must rename, the commands whose usage differs, the same-word-different-
meaning warnings, and the control codes it must replace SHALL each be limited to the commands and
codes the program actually contains. A capability, a group of control codes, or a whole section
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
  and the control codes to replace name only commands and codes the program contains

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

### Requirement: The program is read as the language being ported from

A program's vocabulary is what a *particular* BASIC finds in its text, so the comparison SHALL
decide which commands and control codes the program uses by reading it as the language of the
machine being ported **from**, not as the language of whichever machine the IDE currently has
selected.

This is what lets a program keep its narrowing after it has been moved to a machine that cannot run
it: the text is unchanged, and the comparison is about the language it was written in. Changing the
machine being ported from SHALL re-read the program in that machine's language rather than abandon
the narrowing.

#### Scenario: A program kept on a machine that cannot run it

- **WHEN** the user keeps their program while switching to a machine whose BASIC will not run it,
  and reads the comparison from the machine they left to the machine they chose
- **THEN** the comparison is narrowed to what the program uses, and does not report the program as
  unreadable

#### Scenario: Changing the machine being ported from

- **WHEN** the user selects a different source machine
- **THEN** the comparison narrows to the commands and codes the program's text contains in that
  machine's language

### Requirement: A program that cannot be read is treated as no program

Where the open program has errors that prevent it being read as a program at all in the language
being ported from, the comparison SHALL report every difference, as it does for a reader with no
program. Findings that do not prevent it being read — advice about what a real machine would refuse
at the keyboard, or about variables — SHALL NOT suppress the narrowing, so that ordinary
half-finished editing does not repeatedly discard it.

#### Scenario: A program that cannot be read

- **WHEN** the open program has an error that prevents it being read as a program
- **THEN** every difference is reported, and the comparison says the program cannot be read yet

#### Scenario: A program with findings that still reads

- **WHEN** the open program has findings that do not prevent it being read as a program
- **THEN** the comparison stays narrowed to what the program uses

#### Scenario: Fixing the program

- **WHEN** the user corrects an error that prevented the program being read
- **THEN** the comparison narrows to the program again

### Requirement: The comparison says whether it is narrowed, and why not

The comparison SHALL always state where it stands with respect to the open program, so that a
reader can tell a narrowed comparison from a full one without counting rows.

Where it is narrowed it SHALL say so, stating both how much of the program it recognised and how
many differences it is holding back, and SHALL offer a control that reports them. Where it is not
narrowed but could be, it SHALL say what would narrow it — that the program should be opened in the
IDE, that there is nothing open, or that the open program cannot be read yet.

Stating what is held back is what keeps the narrowing honest: a difference the comparison failed to
recognise is never silently lost, because the count reveals it and the control reaches it.

#### Scenario: Read outside the IDE

- **WHEN** a user opens the comparison on its own
- **THEN** it says that opening the program in the IDE narrows it to what that program uses

#### Scenario: Inside the IDE with nothing open

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** it says that opening a program narrows it to what that program uses

#### Scenario: Inside the IDE with a program that cannot be read

- **WHEN** a user reads the comparison inside the IDE with a program that cannot be read
- **THEN** it says the program cannot be read yet, and points at the errors flagged in the editor

#### Scenario: Narrowed

- **WHEN** the comparison is narrowed to the open program
- **THEN** it says how much of the program it recognised, states how many differences are being
  held back, and offers a control that reports them

#### Scenario: Asking to see everything

- **WHEN** the user turns that control on
- **THEN** every difference for the chosen pair is reported

#### Scenario: A program that uses everything

- **WHEN** the program's vocabulary covers every difference the comparison would report
- **THEN** nothing is stated as held back, and no control to reveal more is shown

### Requirement: Keeping a program on a new machine offers the comparison

Switching to a machine that will not run the open program asks the user whether to keep that
program. Keeping it is the moment a port begins, so the IDE SHALL then open the comparison for
exactly that port — from the machine left to the machine chosen — narrowed to the program that was
kept.

Starting a new program instead SHALL NOT open it, there being no program to port; neither SHALL
cancelling, nor switching to a machine that runs the program as it stands and so never asks.

#### Scenario: Keeping the program

- **WHEN** the user switches to a machine that will not run their program and chooses to keep it
- **THEN** the comparison opens, comparing from the machine they left to the machine they chose,
  narrowed to that program

#### Scenario: Starting a new program instead

- **WHEN** the user switches machine and chooses to start a new program
- **THEN** the comparison is not opened

#### Scenario: Cancelling the switch

- **WHEN** the user cancels the switch
- **THEN** the machine is unchanged and the comparison is not opened

#### Scenario: Switching to a machine that runs the program

- **WHEN** the user switches to a machine that runs the program as it stands, and so is not asked
  whether to keep it
- **THEN** the comparison is not opened

### Requirement: The comparison opens on the machine the program is written for

Where the comparison is opened inside the IDE and nothing names the machines to compare, it SHALL
open comparing *from* the machine the open program is written for — the one selection under which
the narrowing means anything. A link that names the machines SHALL still resolve to the comparison
it names, so a shared comparison reads the same for everyone.

#### Scenario: Opening the comparison from the IDE

- **WHEN** a user with a program open opens the comparison, following nothing that names machines
- **THEN** the source machine is the one the program is written for

#### Scenario: Following a link that names the machines

- **WHEN** a user inside the IDE opens a link naming both machines to compare
- **THEN** the comparison shows that pair, whatever machine the open program is written for

## MODIFIED Requirements

### Requirement: Controls over what is reported are phrased as showing

Every control the comparison offers over how much it reports SHALL be labelled with what turning it
on reveals, never with what turning it on removes, so that a control turned on always means more is
reported. Which controls start on SHALL be decided by what the comparison should open on, and is
unaffected by that phrasing.

#### Scenario: Reading the controls

- **WHEN** the user reads any control the comparison offers over what it reports
- **THEN** it is labelled as showing something, and turning it on adds to what is reported

#### Scenario: What the comparison opens on

- **WHEN** the user opens a comparison
- **THEN** the rows that do not differ, what the target adds where the port loses nothing, and the
  differences that fall outside an open program's vocabulary are still absent until asked for
