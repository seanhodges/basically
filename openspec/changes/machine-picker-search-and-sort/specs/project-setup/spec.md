## MODIFIED Requirements

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
by release year, or grouped by the dialect of BASIC the machine runs. Grouping
by manufacturer SHALL be the arrangement a user who has never chosen one gets.

Within an arrangement the machines SHALL read in a stated order rather than
registration order: by name where the arrangement is anything but year, and
oldest first where it is year. Ordering by name SHALL read a model number as a
number, so that a machine numbered 664 precedes one numbered 6128. Where the
arrangement groups, the groups SHALL be ordered — alphabetically by heading,
except by year, which is oldest first.

The list SHALL show no group heading it has no machines under, in any
arrangement and however the list has been narrowed.

The user SHALL be able to narrow the list by typing, matching a machine's name,
its manufacturer, or the BASIC it runs, without regard to letter case. Where
nothing matches what was typed, the list SHALL say so rather than appearing
empty, and SHALL offer a way back to the whole list.

The typed text and the chosen arrangement SHALL be remembered, so that the list
opens as the user last left it — both later in the same session, wherever a
machine is chosen, and after the IDE is reloaded.

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

#### Scenario: Ordering a group by name

- **WHEN** the user arranges the machine list any way but by year
- **THEN** the machines under each heading read alphabetically by name, with a
  machine numbered 664 before one numbered 6128

#### Scenario: Narrowing the list by typing

- **WHEN** the user types part of a machine's name, its manufacturer, or the
  BASIC it runs
- **THEN** the list shows only the machines that match, still arranged the way
  the user chose, and no heading is left standing without machines under it

#### Scenario: Typing something no machine matches

- **WHEN** the user types text that matches no machine
- **THEN** the list says nothing matched what was typed and offers a way back to
  the whole list

#### Scenario: The list opens as it was left

- **WHEN** the user narrows and rearranges the machine list, then reloads the
  IDE and opens the list again
- **THEN** the same text and the same arrangement are in effect

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
