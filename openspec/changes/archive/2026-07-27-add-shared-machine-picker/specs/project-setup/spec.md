## MODIFIED Requirements

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
