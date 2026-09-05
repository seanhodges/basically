# project-setup Specification

## Purpose

Make starting a program a single deliberate choice: the target machine, a
starting point, and an optional name, decided together and applied only once
the user confirms. Nothing reaches the editor unasked — no sample loads itself
on first launch or on a machine switch — and the bundled samples are reached by
creating a project rather than by a separate load action. Machines are described
well enough to choose between, and the whole dialog stays completable from the
keyboard alone.

## Requirements

### Requirement: Starting a program is one deliberate choice

Creating a new project SHALL present the user with the target machine, a
starting point, and an optional project name together, and SHALL create the
document only once the user confirms. The starting point SHALL offer a blank
program, any of the chosen machine's bundled sample programs, and a
plain-English description of a program to generate.

The chosen machine SHALL be the one the document is created on, whatever machine
was previously active, and switching machines within the dialog SHALL NOT ask the
user to resolve what happens to their existing code — the choice already answers
that.

A starting point that cannot currently work SHALL be presented as unavailable,
noting what the user must do elsewhere to make it available, rather than being
hidden or offered only to fail once chosen.

#### Scenario: Creating a project on a different machine

- **WHEN** the user creates a project choosing a machine other than the active
  one, together with one of that machine's samples
- **THEN** the IDE switches to the chosen machine, the editor holds that sample,
  and no separate target-switch confirmation is raised

#### Scenario: The sample choices follow the machine

- **WHEN** the user changes the chosen machine while creating a project
- **THEN** the offered sample programs are that machine's own

#### Scenario: A starting point that cannot work

- **WHEN** a starting point depends on something the user has not yet set up
- **THEN** it is offered as unavailable, noting what must be set up first, and
  the other starting points remain usable

### Requirement: Nothing is chosen implicitly

The IDE SHALL NOT place a program in the editor that the user did not ask for.
No sample program SHALL be loaded automatically — not on a first launch, and not
when the target machine changes.

#### Scenario: First launch

- **WHEN** a user opens the IDE for the very first time
- **THEN** the editor is empty, and a program appears only once they create one

#### Scenario: Switching machine with an empty editor

- **WHEN** the user switches the target machine while the editor is empty
- **THEN** the editor remains empty on the new machine

### Requirement: Bundled samples are reached by creating a project

Each machine's bundled sample programs SHALL be offered as starting points when
creating a project, and SHALL NOT be offered as a separate load action that
replaces the current document from elsewhere in the interface. Loading a sample
is therefore subject to the same protection against discarding unsaved work as
any other document replacement.

#### Scenario: Loading a sample over unsaved work

- **WHEN** the user starts a project from a sample while holding unsaved changes
- **THEN** they are warned before their work is replaced, and declining leaves
  the current document intact

### Requirement: Machines are described well enough to choose between

The IDE SHALL offer the target machine as a single control naming the machine
currently chosen, which opens the list of machines when the user acts on it.
Wherever a machine is chosen — starting a project, or switching the machine of
the program already open — that same list SHALL be presented.

In the list, the IDE SHALL identify each machine by its manufacturer, its
release year, a one-line description of what it is, and a likeness of the
machine. Every machine the IDE supports SHALL carry this information.

The list SHALL be arranged one of several ways, chosen by the user from a
control the list carries: grouped by manufacturer, ungrouped by model, grouped
by release year, or grouped by the family of BASIC the machine runs. Grouping by
manufacturer SHALL be the arrangement a user who has never chosen one gets.

Where the list is grouped by the BASIC the machines run, the grouping SHALL be
by family rather than by version, so that machines running different versions of
one BASIC read under one heading rather than under a heading each. The heading
SHALL name the family. Each machine's own description SHALL still name the
version it runs, so that grouping machines together never hides which of them
runs what.

Within an arrangement the machines SHALL read in a stated order rather than
registration order: by name where the arrangement is anything but year, and
oldest first where it is year. Ordering by name SHALL read a model number as a
number, so that a machine numbered 664 precedes one numbered 6128. Where the
arrangement groups, the groups SHALL be ordered — alphabetically by heading,
except by year, which is oldest first.

The list SHALL show no group heading it has no machines under, in any
arrangement and however the list has been narrowed.

The user SHALL be able to narrow the list by typing, matching a machine's name,
its manufacturer, or the BASIC it runs, without regard to letter case. The BASIC
it runs SHALL be matched by the name of its family and by the name of the
version that machine runs alike, so that a user who knows either finds the
machine. Where nothing matches what was typed, the list SHALL say so rather than
appearing empty, and SHALL offer a way back to the whole list.

The typed text and the chosen arrangement SHALL be remembered, so that the list
opens as the user last left it — both later in the same session, wherever a
machine is chosen, and after the IDE is reloaded.

Remembered text SHALL NOT be allowed to hide the machine currently chosen: where
the list would open without that machine among those it shows, the text SHALL be
dropped and every machine shown. This applies only as the list opens; text the
user types SHALL narrow the list as typed, whether or not the chosen machine
survives it.

The list SHALL be presented at a size fixed to the screen, which SHALL NOT change
as the list is narrowed or rearranged. The machines SHALL scroll within it,
reading from its top, while the means of narrowing and arranging them stay where
they are.

As the list opens it SHALL bring the machine currently chosen into view: in the
middle of the list where the list can put it there, at the list's top or bottom
where the machine is too near an end to be centred, and unmoved where every
machine already fits. Opening the list SHALL start the keyboard on that machine
rather than on the means of narrowing the list, so that opening it on a touch
device does not raise the on-screen keyboard unasked.

Each machine's description SHALL name the dialect of BASIC that machine runs,
and SHALL add one distinguishing fact about the machine where that also fits. It
SHALL be brief enough to be read in full on a phone-width screen rather than
being cut short; where both cannot fit, naming the dialect takes precedence over
the machine fact.

The control that opens the list SHALL identify the chosen machine by name and by
its likeness. Where the interface is too narrow to show the name, the machine
SHALL remain identifiable by other means rather than the control becoming
anonymous.

#### Scenario: Choosing an unfamiliar machine

- **WHEN** the user opens the machine list without having chosen how it is
  arranged
- **THEN** each machine is shown grouped under its manufacturer, with its
  release year, a description of the machine, and a likeness of it

#### Scenario: Arranging the list another way

- **WHEN** the user arranges the machine list by release year
- **THEN** the machines are grouped under the year each was released, oldest
  year first, and only years that hold a machine are headed

#### Scenario: Arranging the list by the BASIC the machines run

- **WHEN** the user arranges the machine list by the BASIC the machines run, and
  two of the machines run different versions of one BASIC
- **THEN** both read under one heading naming the family, and each machine's own
  description still names the version it runs

#### Scenario: Machines whose BASICs are unrelated stay apart

- **WHEN** the user arranges the machine list by the BASIC the machines run, and
  two machines run BASICs that are not versions of one another
- **THEN** they read under separate headings, however much else the two machines
  have in common

#### Scenario: Ordering a group by name

- **WHEN** the user arranges the machine list any way but by year
- **THEN** the machines under each heading read alphabetically by name, with a
  machine numbered 664 before one numbered 6128

#### Scenario: Narrowing the list by typing

- **WHEN** the user types part of a machine's name, its manufacturer, or the
  BASIC it runs
- **THEN** the list shows only the machines that match, still arranged the way
  the user chose, and no heading is left standing without machines under it

#### Scenario: Narrowing the list by a version rather than a family

- **WHEN** the user types the name of the particular version of a BASIC that one
  machine of a family runs
- **THEN** that machine is among those the list shows, rather than the text
  matching only the family name its heading carries

#### Scenario: Typing something no machine matches

- **WHEN** the user types text that matches no machine
- **THEN** the list says nothing matched what was typed and offers a way back to
  the whole list

#### Scenario: The list opens as it was left

- **WHEN** the user narrows and rearranges the machine list, then reloads the
  IDE and opens the list again
- **THEN** the same text and the same arrangement are in effect

#### Scenario: What was remembered would hide the machine in use

- **WHEN** the user opens the machine list while the remembered text matches no
  machine, or matches machines but not the one currently chosen
- **THEN** the text is dropped and every machine is shown, so the list never
  opens without the machine the user is on

#### Scenario: Narrowing the list does not resize it

- **WHEN** the user types into the machine list, matching first several machines
  and then none at all
- **THEN** the list stays the size it was, the machines that match scroll within
  it from the top, and the text the user is typing into does not move

#### Scenario: The list opens on the machine in use

- **WHEN** the user opens the machine list on a machine that has machines both
  above and below it
- **THEN** that machine is shown in the middle of the list, and the keyboard is
  on it

#### Scenario: The machine in use is too near an end to centre

- **WHEN** the user opens the machine list on the first machine in it
- **THEN** the list is shown from its top rather than scrolled above its own
  first machine

#### Scenario: Opening the list on a phone

- **WHEN** the user opens the machine list on a touch device
- **THEN** the on-screen keyboard stays down, and rises only once the user acts
  on the means of narrowing the list

#### Scenario: Reading the descriptions on a phone

- **WHEN** the user opens the machine list on a phone-width screen
- **THEN** each machine's description reads in full rather than being cut off
  part-way, and names the dialect of BASIC that machine runs

#### Scenario: The machine list is not shown until it is asked for

- **WHEN** the user is creating a project and has not opened the machine list
- **THEN** only the chosen machine is shown, described and identifiable, and the
  other machines are not listed

#### Scenario: Dismissing the machine list

- **WHEN** the user opens the machine list from within another dialog and then
  dismisses it, or chooses a machine from it
- **THEN** only the machine list closes, and the dialog it was opened from
  remains open with the choice reflected in it

### Requirement: A project may be named when it is created

The user SHALL be able to name a project as they create it, rather than the
document remaining untitled until it is first saved. Leaving the name blank
SHALL produce an untitled document.

#### Scenario: Naming a new project

- **WHEN** the user creates a project and gives it a name
- **THEN** the document carries that name from the moment it is created

### Requirement: Creating a project stays fast for the keyboard

The creation dialog SHALL open with the currently active machine and a blank
program already selected, and SHALL be completable from the keyboard alone, so
that a user who wants exactly what the previous behaviour gave them — an empty
program on the current machine — can confirm immediately without making any
selection.

#### Scenario: Accepting the defaults

- **WHEN** the user invokes new-project from the keyboard and immediately
  confirms
- **THEN** they get an empty program on the machine they were already using

#### Scenario: Abandoning creation

- **WHEN** the user dismisses the creation dialog without confirming
- **THEN** the current document and target machine are left exactly as they were
