## ADDED Requirements

### Requirement: Differences in usage notation are not reported as behaviour changes

Where a command exists on both dialects and the two references describe its usage equivalently —
differing only in how each names its placeholders — the comparison SHALL NOT report the command as
behaving differently. A difference in what the command accepts, in whether its arguments are
parenthesised, or in what category of keyword it is, SHALL still be reported.

#### Scenario: The same usage written with different placeholder names

- **WHEN** the user compares two dialects whose references describe a shared command's usage the
  same way apart from the names given to its placeholders
- **THEN** the command is not reported as behaving differently

#### Scenario: A real difference in usage

- **WHEN** a shared command takes a different number of arguments, differs in whether its arguments
  are parenthesised, or is a command on one dialect and a function on the other
- **THEN** the command is reported as behaving differently

### Requirement: A reported behaviour change says what changed

Where the comparison reports that a shared command behaves differently, it SHALL state what changed
about it, rather than only presenting each dialect's usage for the reader to compare.

#### Scenario: A command reported as changed

- **WHEN** the comparison reports a shared command as behaving differently
- **THEN** it names the nature of the change alongside each dialect's usage

### Requirement: Control codes are grouped by what they do

The comparison SHALL group the control codes a port must replace, and those it newly gains, by what
the codes do — colour, cursor movement, block graphics and so on — rather than as a single
alphabetical list. Each set of codes SHALL be grouped and ordered as its own dialect's control-code
reference categorises them, since what the categories mean is particular to each machine. Each group
SHALL state how many codes it contains, every code SHALL be named within exactly one group, and a
category from which the port loses or gains no code SHALL NOT be shown.

#### Scenario: Codes reported by category

- **WHEN** the user compares two dialects with control codes to replace
- **THEN** the codes are reported as groups named for what they do, in the source dialect's own
  category order, each stating its total

#### Scenario: Grouping loses no control code

- **WHEN** the comparison groups the control codes
- **THEN** every code that would otherwise have been listed ungrouped appears in exactly one group

#### Scenario: A category the port does not touch

- **WHEN** the port loses no code belonging to a given category
- **THEN** no group is shown for that category

### Requirement: The comparison leads with what the port requires

The comparison SHALL present what the port requires the reader to do — how the two machines differ,
what is specific to this pair and this target, the commands that fail silently, and the commands
that must be rewritten — before the lists it provides for reference, being the commands to rename,
the commands whose behaviour changed, and the control codes. Guidance that does not vary with the
chosen pair SHALL NOT be placed between two sections that do.

#### Scenario: Reading the comparison top to bottom

- **WHEN** the user reads a comparison from the top
- **THEN** the language and hardware differences, the guidance for this pair and target, the
  same-name-different-meaning warnings and the commands to replace are reached before the commands
  to rename, the commands whose behaviour changed, and the control codes

#### Scenario: Guidance that does not depend on the pair

- **WHEN** the comparison presents guidance that is the same whichever pair is chosen
- **THEN** that guidance is not interleaved with the sections that describe the chosen pair

### Requirement: The language differences report how the machine handles numbers

The language and hardware differences SHALL report whether each dialect has floating point or is
integer-only, and where it is integer-only, the range of values it can hold.

#### Scenario: Porting to an integer-only machine

- **WHEN** the user selects a target dialect that has no floating point
- **THEN** the language differences report the target as integer-only, with the range of values it
  holds, against the source's own number handling

## MODIFIED Requirements

### Requirement: Long difference lists are capped, with more available

Where a difference list that reports a detailed row per entry (a category of commands the comparison
reports) has more entries than fit comfortably on screen, the comparison SHALL render only an
initial portion of it by default and SHALL offer a way to reveal the remaining entries. The count
shown alongside the list's heading or summary SHALL always reflect every entry in the list, not only
the portion currently visible. A list short enough to fit already SHALL render in full, with no such
control shown.

The commands a port must replace and the control codes are exempt: they are grouped — by capability
and by what the code does respectively — and named compactly rather than given a row each, so every
one of them is shown.

#### Scenario: A short list needs no control

- **WHEN** a difference list has few enough entries to render in full by
  default
- **THEN** every entry is shown, and no control to reveal more is present

#### Scenario: A long list is capped by default

- **WHEN** a difference list has more entries than the default visible
  portion
- **THEN** only the initial portion is shown, together with a control stating
  how many further entries exist

#### Scenario: Revealing the rest

- **WHEN** the user activates the control to reveal more of a capped list
- **THEN** the remaining entries of that list are shown, and the control is no
  longer present

#### Scenario: Counts reflect the whole list

- **WHEN** a difference list is capped
- **THEN** any count reported for that list (in its heading or in the
  comparison's summary) reflects every entry, not only the visible portion

#### Scenario: Choosing a new pair resets capped lists

- **WHEN** the user changes which dialects are being compared, having
  previously revealed a capped list in full
- **THEN** the new comparison's difference lists are shown capped again

#### Scenario: The grouped commands to replace are never capped

- **WHEN** a port loses more commands than would fit as detailed rows
- **THEN** every lost command is still named within its capability group, and no
  control to reveal more is shown for those groups

#### Scenario: The grouped control codes are never capped

- **WHEN** a port loses or gains more control codes than would fit as detailed rows
- **THEN** every one of them is still named within its category group, and no control to reveal
  more is shown for those groups
