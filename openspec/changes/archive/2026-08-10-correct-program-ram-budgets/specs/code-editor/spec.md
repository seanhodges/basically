## MODIFIED Requirements

### Requirement: The RAM budget is always visible

The IDE SHALL continuously show the tokenized program's byte size against the
machine's available program RAM, so the user can see headroom before running.

The figure it is shown against SHALL be the RAM the machine itself leaves free
for a BASIC program at its Ready prompt, on the machine as the IDE emulates it.
It SHALL NOT exceed what that machine reports free, so a program the IDE says
fits is a program the machine can hold. It MAY be smaller where the machine
spends RAM out of the program area as a program runs — a display file that grows
with the screen, for instance — so that the headroom shown is headroom a running
program still has.

#### Scenario: Growing program

- **WHEN** the user adds lines to the program
- **THEN** the byte counter updates to reflect the new tokenized size

#### Scenario: The budget matches the machine

- **WHEN** the user compares the budget shown while editing with the free figure
  the same machine reports once it is running
- **THEN** the two agree, rather than the budget promising memory the machine
  does not have

#### Scenario: Changing machine changes the budget

- **WHEN** the user switches the program to a machine with less program RAM
- **THEN** the same program is measured against the new machine's smaller figure,
  and reports as closer to full
