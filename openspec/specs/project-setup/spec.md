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
machine, and SHALL group the machines by manufacturer. Every machine the IDE
supports SHALL carry this information.

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

- **WHEN** the user opens the machine list
- **THEN** each machine is shown grouped under its manufacturer, with its
  release year, a description of the machine, and a likeness of it

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
