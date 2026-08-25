## MODIFIED Requirements

### Requirement: Code blocks are editable as assembly

A code block SHALL be editable as assembly source for the machine's CPU in
its own editor tab, assembled with errors reported per line (never thrown),
and the block's tab SHALL show when its source currently fails to assemble.

The block's editor SHALL offer the same general editing the BASIC editor does —
undo, redo, cut, copy, paste and find/replace — and SHALL carry its own edit
history, which survives showing a different tab and coming back.

Where a block's bytes change from outside its editor, the editor SHALL be
re-seeded from the new bytes and that re-seeding SHALL NOT be undoable, since
undoing it would leave source that no longer describes the block.

#### Scenario: Assembly error

- **WHEN** the user introduces a syntax error in a block's assembly source
- **THEN** the error is shown at its line and the block's tab is flagged

#### Scenario: A block's history outlives showing another tab

- **WHEN** the user edits a block's assembly, shows another tab, comes back and
  undoes
- **THEN** that block's own last edit is undone

#### Scenario: Editing one block leaves another alone

- **WHEN** the user edits one block, shows a second block and undoes
- **THEN** the second block is unchanged and the first keeps its edit
