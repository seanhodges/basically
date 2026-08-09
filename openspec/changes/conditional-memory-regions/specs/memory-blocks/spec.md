## ADDED Requirements

### Requirement: A block may sit in conditionally free memory

Some machines hold memory that hardware claims only when the program exercises
an optional feature — video RAM above the text screen that only the graphics
modes reach, a band under a bitmap screen the machine's boot mode never
touches. On the real machine, programs that leave the feature alone use that
memory freely; a checker that always assumes the feature in use refuses
placements the machine accepts.

Where a machine declares such a region, with the condition under which the
program leaves it untouched, a block placed there SHALL be accepted when the
open program's own text meets the condition — the screen modes it selects with
constant arguments, and the addresses it writes. The acceptance SHALL carry a
warning naming the condition the placement leans on, so a program that later
comes to use the feature has a visible thread back to the block that must
move.

Where the condition is not met, or a mode is selected with a value the text
does not fix, or the program writes into the region, or there is no program to
read, the placement SHALL be refused as it is today, and the refusal SHALL
name the condition that would make it legal. Doubt SHALL run toward refusal:
memory that cannot be proven free is not free.

Machines that declare no such region SHALL behave exactly as before.

#### Scenario: A block in video RAM the program never draws to

- **WHEN** a machine declares its graphics memory conditionally free, the open
  program stays in the text mode, and the user places a block in that region
- **THEN** the run is allowed, with a warning naming the condition the
  placement depends on

#### Scenario: The program selects a graphics mode

- **WHEN** a block sits in a conditionally free region and the open program
  selects a screen mode that claims that region
- **THEN** the run is refused, and the refusal names the condition under which
  the region would be free

#### Scenario: A mode the text does not fix

- **WHEN** a block sits in a conditionally free region and the open program
  selects a screen mode whose value is computed rather than written as a
  constant
- **THEN** the run is refused, as it is when the condition is unmet

#### Scenario: A write into the region

- **WHEN** a block sits in a conditionally free region and the open program
  writes to an address inside that region
- **THEN** the run is refused, whatever modes the program selects

#### Scenario: A machine without conditional regions

- **WHEN** a block is placed on a machine that declares no conditionally free
  region
- **THEN** every placement lints exactly as it did before
