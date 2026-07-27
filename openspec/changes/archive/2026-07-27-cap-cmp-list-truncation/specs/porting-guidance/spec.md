## ADDED Requirements

### Requirement: Long difference lists are capped, with more available

Where a difference list (a category of commands or control codes the
comparison reports) has more entries than fit comfortably on screen, the
comparison SHALL render only an initial portion of it by default and SHALL
offer a way to reveal the remaining entries. The count shown alongside the
list's heading or summary SHALL always reflect every entry in the list, not
only the portion currently visible. A list short enough to fit already SHALL
render in full, with no such control shown.

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
