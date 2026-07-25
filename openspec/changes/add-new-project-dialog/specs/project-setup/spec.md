## ADDED Requirements

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
stating why and offering a route to resolve it, rather than being hidden or
offered only to fail once chosen.

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
- **THEN** it is offered as unavailable with the reason and a way to resolve it,
  and the other starting points remain usable

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

When offering the target machine, the IDE SHALL identify each machine by its
manufacturer, its release year, and a one-line description of what it is, and
SHALL group the machines by manufacturer. Every machine the IDE supports SHALL
carry this information.

#### Scenario: Choosing an unfamiliar machine

- **WHEN** the user is choosing a target machine while creating a project
- **THEN** each machine is shown grouped under its manufacturer, with its
  release year and a description of the machine

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
