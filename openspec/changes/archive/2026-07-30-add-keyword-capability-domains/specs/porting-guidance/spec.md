## ADDED Requirements

### Requirement: Differences are grouped by what they do

The comparison SHALL group the commands a port must replace by the capability
they provide — control flow, data, numbers, strings, text and screen, graphics,
colour, sound, input, storage, memory and hardware, program editing, and error
handling — rather than presenting them as a single alphabetical list. Groups
SHALL be ordered so that capabilities the target machine does not provide at all
are reported before capabilities it does provide, and every command SHALL appear
in exactly one group. Each group SHALL state how many commands it contains.

A group SHALL name its commands compactly, as a single run of names, rather than
as one detailed row per command — the advice a reader acts on is written per
capability, not per command, so repeating a description against every lost
command makes the guide longer without making it clearer. Every command in a
group SHALL be named, with nothing hidden behind a control to reveal more. A
capability from which the port loses no command SHALL NOT be shown at all.

#### Scenario: A port that loses a whole capability

- **WHEN** the user compares a source dialect against a target that provides no
  equivalent of an entire capability the source has
- **THEN** that capability is reported as a group, before capabilities the target
  does provide, and the commands lost from it are named within it

#### Scenario: Grouping loses nothing

- **WHEN** the comparison groups the commands to replace
- **THEN** every command that would otherwise have been listed ungrouped appears
  in exactly one group, and each group states its own total

#### Scenario: A capability the port does not touch

- **WHEN** the source dialect loses no command belonging to a given capability
- **THEN** no group is shown for that capability

#### Scenario: A group with many commands

- **WHEN** a port loses a large number of commands from one capability
- **THEN** every one of them is named in that group as a compact run of names,
  and no control to reveal further commands is present

## MODIFIED Requirements

### Requirement: Long difference lists are capped, with more available

Where a difference list that reports a detailed row per entry (a category of
commands or control codes the comparison reports) has more entries than fit
comfortably on screen, the comparison SHALL render only an initial portion of it
by default and SHALL offer a way to reveal the remaining entries. The count shown
alongside the list's heading or summary SHALL always reflect every entry in the
list, not only the portion currently visible. A list short enough to fit already
SHALL render in full, with no such control shown.

The commands a port must replace are exempt: they are grouped by capability and
named compactly rather than given a row each, so every one of them is shown.

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
