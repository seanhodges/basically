## MODIFIED Requirements

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
document. A share link SHALL NOT carry them.

Switching the target machine SHALL follow the answer the user gives about their
program: buffers SHALL be kept when the user keeps their code, since they are the
workbench of the program that is moving, and SHALL be discarded when the user
starts a new program on the new machine. A switch that keeps the code without
asking — because the new machine takes the program as it stands — SHALL keep them
too.

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

#### Scenario: Keeping the program on a new machine keeps the buffers

- **WHEN** the user switches to a different target machine while scratch buffers
  exist, and chooses to keep their code
- **THEN** every buffer is still open on the new machine, under its name and with
  its contents

#### Scenario: Starting new on a new machine discards the buffers

- **WHEN** the user switches to a different target machine while scratch buffers
  exist, and chooses to start a new program
- **THEN** the buffers are discarded with the program they belonged to

#### Scenario: A restored buffer carries no breakpoints

- **WHEN** the user sets a breakpoint in a scratch buffer, then reloads the IDE
  or reopens the saved project
- **THEN** the buffer returns with its contents and no breakpoints set
