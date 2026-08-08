## MODIFIED Requirements

### Requirement: Control codes are grouped by what they do

The comparison SHALL group the control codes a port must replace by what the codes do — colour,
cursor movement, block graphics and so on — rather than as a single alphabetical list, grouped and
ordered as the source dialect's own control-code reference categorises them, since what the
categories mean is particular to each machine. Each group SHALL state how many codes it contains,
every code SHALL be named within exactly one group, and a category from which the port loses no code
SHALL NOT be shown.

Control codes are not equal work: a machine may express a whole class of them under its own
spellings, express the class only partly, or have no way to express it at all. Each group SHALL
therefore state which of those three the target machine offers for that class of code, and where the
target cannot express the class fully, SHALL say what to do instead. That advice SHALL be given once
per group, not against each code, since what a reader acts on is the same for every code in the
class.

The control codes the target adds and the source never had are not work the port must do, so they
SHALL be reported only as a count, with a pointer to the target's control-code reference, and SHALL
NOT be listed code by code.

#### Scenario: Codes reported by category

- **WHEN** the user compares two dialects with control codes to replace
- **THEN** the codes are reported as groups named for what they do, in the source dialect's own
  category order, each stating its total

#### Scenario: A class the target cannot express at all

- **WHEN** a group of control codes belongs to a class the target machine has no way to express
- **THEN** the group states that, and says what to do instead

#### Scenario: A class the target expresses under its own spellings

- **WHEN** a group of control codes belongs to a class the target machine expresses fully under its
  own spellings
- **THEN** the group states that, so the reader can tell mechanical replacement from a rewrite

#### Scenario: Advice is given once per group

- **WHEN** a group contains many control codes of one class
- **THEN** the advice for that class is given once for the group, not repeated against each code

#### Scenario: Grouping loses no control code

- **WHEN** the comparison groups the control codes
- **THEN** every code that would otherwise have been listed ungrouped appears in exactly one group

#### Scenario: A category the port does not touch

- **WHEN** the port loses no code belonging to a given category
- **THEN** no group is shown for that category

#### Scenario: Codes the target adds

- **WHEN** the target dialect has control codes the source dialect does not
- **THEN** they are reported as a count, with a pointer to the target's control-code reference,
  rather than listed individually
