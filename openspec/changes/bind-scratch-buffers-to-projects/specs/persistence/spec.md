## REMOVED Requirements

### Requirement: Scratch buffers do not persist

**Reason**: Scratch buffers are being rebound from session-only workbench to part
of the project, which inverts every guarantee this requirement makes except the
machine-switch rule. Replaced by "Scratch buffers belong to the project".

**Migration**: None needed by users. Buffers that previously vanished on reload
now return; buffers that previously outlived a document swap are now cleared by
it. Project bundles saved before this change carry no buffers and open with none.

## ADDED Requirements

### Requirement: Scratch buffers belong to the project

Scratch buffers SHALL be part of the project that holds them. Saving a project
SHALL preserve each buffer's name and contents, and opening a saved project SHALL
restore exactly the buffers it was saved with, replacing any that were open — so
a project saved without buffers opens without them. Autosaved work in progress
SHALL carry scratch buffers too, so reopening the IDE restores them alongside the
document they belong to.

Scratch buffers SHALL be discarded whenever the document is replaced: creating a
new project, opening a project or a plain source file, loading a sample, or
importing a file. Applying assistant-generated code to the open program SHALL
leave them untouched, since that edits the program rather than replacing the
document. They SHALL also be discarded when the user switches target machine,
where they hold code in a dialect the new machine does not speak, and a share
link SHALL NOT carry them.

Because replacing a document now destroys scratch work, the warning that protects
unsaved changes SHALL also be given when scratch buffers exist, and declining it
SHALL leave both the document and its buffers intact.

Restored buffers SHALL return with their names and contents but without
breakpoints, which last only as long as the session that set them.

#### Scenario: Scratch buffers survive a reload

- **WHEN** the user writes a snippet into a scratch buffer and reloads the IDE
- **THEN** the buffer is restored under its name with its snippet intact

#### Scenario: A saved project carries its scratch buffers

- **WHEN** the user saves a project while scratch buffers exist, and later opens
  that saved project
- **THEN** the document and every scratch buffer it was saved with are restored

#### Scenario: Opening a project replaces the buffers that were open

- **WHEN** the user has scratch buffers open and opens a project that was saved
  without any
- **THEN** the open buffers are discarded rather than kept alongside the
  incoming project

#### Scenario: Starting a new project clears the workbench

- **WHEN** the user creates a new project while scratch buffers exist
- **THEN** the new project starts with no scratch buffers

#### Scenario: Loading a different program clears the workbench

- **WHEN** the user loads a sample, opens a plain source file, or imports a file
  while a scratch buffer holds a snippet
- **THEN** the new program is loaded and the scratch buffer is discarded with the
  document it belonged to

#### Scenario: Applying assistant code keeps the buffers

- **WHEN** the assistant's code is applied to the program the user already has
  open, while scratch buffers exist
- **THEN** the program is updated and every scratch buffer still holds its
  contents

#### Scenario: Discarding a document warns about scratch work

- **WHEN** the user starts a new project or opens another one while scratch
  buffers exist, and declines the warning
- **THEN** the current document and its scratch buffers are left as they were

#### Scenario: Switching machine discards scratch buffers

- **WHEN** the user switches to a different target machine
- **THEN** the scratch buffers are discarded

#### Scenario: A restored buffer carries no breakpoints

- **WHEN** the user sets a breakpoint in a scratch buffer, then reloads the IDE
  or reopens the saved project
- **THEN** the buffer returns with its contents and no breakpoints set
