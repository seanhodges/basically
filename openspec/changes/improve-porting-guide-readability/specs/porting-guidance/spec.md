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

The comparison SHALL group the control codes a port must replace by what the codes do — colour,
cursor movement, block graphics and so on — rather than as a single alphabetical list, grouped and
ordered as the source dialect's own control-code reference categorises them, since what the
categories mean is particular to each machine. Each group SHALL state how many codes it contains,
every code SHALL be named within exactly one group, and a category from which the port loses no code
SHALL NOT be shown.

The control codes the target adds and the source never had are not work the port must do, so they
SHALL be reported only as a count, with a pointer to the target's control-code reference, and SHALL
NOT be listed code by code.

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

#### Scenario: Codes the target adds

- **WHEN** the target dialect has control codes the source dialect does not
- **THEN** they are reported as a count, with a pointer to the target's control-code reference,
  rather than listed individually

### Requirement: The comparison leads with what the port requires

The comparison SHALL present what the port requires the reader to do — how the two machines differ,
what is specific to this pair and this target, the commands that fail silently, and the commands
that must be rewritten — before the lists it provides for reference, being the commands whose
spelling or usage differs and the control codes. Guidance that does not vary with the chosen pair
SHALL NOT be placed between two sections that do.

#### Scenario: Reading the comparison top to bottom

- **WHEN** the user reads a comparison from the top
- **THEN** the language and hardware differences, the guidance for this pair and target, the
  same-name-different-meaning warnings and the commands to replace are reached before the commands
  whose spelling or usage differs and the control codes

#### Scenario: Guidance that does not depend on the pair

- **WHEN** the comparison presents guidance that is the same whichever pair is chosen
- **THEN** that guidance is not interleaved with the sections that describe the chosen pair

### Requirement: What the port loses and gains in a capability is reported together

Where the comparison reports the commands a port must replace in a capability and the commands the
target adds in that same capability, it SHALL report them together, as one account of that
capability, rather than in two separate places. A capability the target adds commands to but from
which the port loses nothing SHALL be reported after the capabilities that lose commands.

#### Scenario: A capability that both loses and gains commands

- **WHEN** a port loses commands from a capability and the target provides commands in that
  capability the source does not
- **THEN** both are reported together in that capability's own account, not in two separate parts of
  the comparison

#### Scenario: A capability that only gains

- **WHEN** the target adds commands in a capability the port loses nothing from
- **THEN** that capability is reported after the capabilities the port loses commands from

### Requirement: What the target adds and the program never used can be filtered out

What the target offers where the port loses nothing is the one part of the comparison that is not
work the port requires. The comparison SHALL offer a control that hides it — both the capabilities
with nothing to replace and the control codes the target adds — and that control SHALL be on by
default, with what it is hiding stated so it can be found. Turning it off SHALL report them again.
What the target offers in a capability the port *does* lose commands from is the advice for
replacing them, and SHALL NOT be hidden by this control.

#### Scenario: The default view

- **WHEN** the user opens a comparison
- **THEN** the capabilities the target only adds to and the control codes it adds are hidden, and
  the comparison states how many capability areas are hidden

#### Scenario: Asking to see them

- **WHEN** the user turns the control off
- **THEN** the capabilities the target only adds to, and the control codes it adds, are reported

#### Scenario: Advice for a capability that loses commands is never hidden

- **WHEN** the control is on and the port loses commands from a capability the target also adds to
- **THEN** what the target offers in that capability is still reported with the commands lost from
  it

### Requirement: Differing spellings and differing usage are reported together

The commands both dialects provide under different spellings and the commands they provide with
different usage SHALL be reported together, as one account of the commands that exist on both
machines but are not written the same way. A command that only changes spelling SHALL be reported
compactly — its two spellings — rather than as a detailed entry.

#### Scenario: A pair with both renames and usage differences

- **WHEN** the comparison reports commands to rename and commands whose usage differs
- **THEN** both are reported together rather than in two separate parts of the comparison

#### Scenario: A command that only changes spelling

- **WHEN** a command exists on both dialects under different spellings and is otherwise the same
- **THEN** it is reported as its two spellings, without a detailed entry of its own

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

The commands a port must replace, the commands it need only rename, and the control codes it must
replace are exempt: they are named compactly — grouped by capability, grouped by what the code does,
or given as a run of spellings — rather than given a row each, so every one of them is shown.

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

- **WHEN** a port loses more control codes than would fit as detailed rows
- **THEN** every one of them is still named within its category group, and no control to reveal
  more is shown for those groups

#### Scenario: The commands to rename are never capped

- **WHEN** a port renames more commands than would fit as detailed rows
- **THEN** every rename is still named in the compact run, and no control to reveal more is shown
  for it
