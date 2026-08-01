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
part of the comparison SHALL be unaffected — narrowing is an extra for the user who has a program,
never a condition of the guidance.

#### Scenario: Reading the comparison with a program open

- **WHEN** a user reads the comparison inside the IDE with a program open, ported from the machine
  that program is written for
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
- **THEN** every difference is reported, no narrowing control is offered, and the comparison is
  unchanged in every other respect

#### Scenario: An empty program

- **WHEN** a user reads the comparison inside the IDE with nothing written in the editor
- **THEN** every difference is reported, as it is for a reader with no program at all

### Requirement: The narrowed comparison says what it is holding back

A comparison that reports less than it knows SHALL say so. Where the narrowing is in effect, the
comparison SHALL state how many differences it is leaving out, and SHALL offer a control that
reports them. Both SHALL be present whenever anything is being held back, so that a difference the
narrowing did not recognise is never silently lost.

Turning the control on SHALL report every difference for the chosen pair, and SHALL leave the
narrowing available to return to.

#### Scenario: Differences are being held back

- **WHEN** the comparison is narrowed and some differences fall outside the program's vocabulary
- **THEN** the comparison states how many differences are being left out, and a control to report
  them is present

#### Scenario: Asking to see everything

- **WHEN** the user turns that control on
- **THEN** every difference for the chosen pair is reported

#### Scenario: A program that uses everything

- **WHEN** the program's vocabulary covers every difference the comparison would report
- **THEN** nothing is stated as held back, and no control to reveal more is shown

### Requirement: Narrowing applies only to the machine the program is written for

A program's vocabulary describes one language. The comparison SHALL narrow only while the machine
being ported *from* is the machine the open program is written for. Where the user selects any
other source machine, the comparison SHALL report every difference and SHALL NOT offer the
narrowing control, rather than filter by a vocabulary that does not describe the language on
screen.

#### Scenario: Changing the source machine away from the program's

- **WHEN** the user selects a source machine other than the one the open program is written for
- **THEN** every difference is reported and no narrowing control is present

#### Scenario: Changing it back

- **WHEN** the user selects the open program's machine as the source machine again
- **THEN** the comparison narrows to the program once more

#### Scenario: Changing the target machine

- **WHEN** the user selects a different target machine
- **THEN** the comparison stays narrowed to the program

### Requirement: The comparison opens on the machine the program is written for

Where the comparison is opened inside the IDE and the link names no source machine, it SHALL open
comparing *from* the machine the open program is written for — the one selection under which the
narrowing means anything. A link that names a source machine SHALL still resolve to the comparison
it names, so a shared comparison reads the same for everyone.

#### Scenario: Opening the comparison from the IDE

- **WHEN** a user with a program open opens the comparison, following no link that names machines
- **THEN** the source machine is the one the program is written for

#### Scenario: Following a link that names the machines

- **WHEN** a user inside the IDE opens a link naming both machines to compare
- **THEN** the comparison shows that pair, whatever machine the open program is written for

### Requirement: The comparison is reachable from the IDE

The IDE SHALL offer a way to open the comparison directly, without the user having to find it
through the documentation's own navigation. Opening it that way SHALL leave the program and the
selected machine as they were.

#### Scenario: Opening the comparison from the IDE

- **WHEN** a user asks the IDE for the porting guide
- **THEN** the comparison opens, with the program and the selected machine unchanged

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
