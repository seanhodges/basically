## ADDED Requirements

### Requirement: Scratch buffers do not persist

Scratch buffers SHALL last only as long as the session that created them. They
SHALL NOT be written to autosaved work in progress, SHALL NOT be included when a
document is saved as a project bundle, and SHALL NOT be carried by a share link.
Reopening the IDE SHALL restore the document exactly as it would have without
them.

Scratch buffers SHALL survive a change of document — starting a new program,
opening one, loading a sample or importing a file — since they are a workbench
rather than part of any document. They SHALL be discarded when the user switches
target machine, where they hold code in a dialect the new machine does not speak.

#### Scenario: Scratch buffers are gone after a reload

- **WHEN** the user creates scratch buffers, then reloads the IDE
- **THEN** the restored document is the one autosave held, with no scratch
  buffers

#### Scenario: A saved project carries no scratch buffers

- **WHEN** the user saves a document as a project bundle while scratch buffers
  exist, and opens that bundle again
- **THEN** the document is restored with its own source and blocks, and no
  scratch buffers

#### Scenario: Opening a different program keeps the workbench

- **WHEN** the user opens a different program while a scratch buffer holds a
  snippet
- **THEN** the new program is loaded and the scratch buffer still holds its
  snippet

#### Scenario: Switching machine discards scratch buffers

- **WHEN** the user switches to a different target machine
- **THEN** the scratch buffers are discarded
