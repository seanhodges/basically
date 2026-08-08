## ADDED Requirements

### Requirement: Disposable scratch buffers

The editor SHALL let the user create scratch buffers: additional BASIC buffers,
held alongside the program, for writing code that is not part of the document.
The user SHALL be able to hold several at once, choose which one the editor
shows, rename one, and close one without being asked to confirm.

A scratch buffer SHALL offer the same editing the program does — the active
dialect's highlighting, completion, inline diagnostics and line-number
management — since it holds the same kind of code.

Editing a scratch buffer SHALL NOT alter the program, SHALL NOT mark the
document as having unsaved changes, and SHALL NOT change what saving, sharing or
exporting the document produces. Which buffer the editor is showing SHALL be
apparent to the user.

Closing a scratch buffer SHALL discard it and everything attached to it.

#### Scenario: A snippet is written without touching the program

- **WHEN** the user creates a scratch buffer and types a program into it
- **THEN** the document's own source is unchanged and the document is not marked
  as having unsaved changes

#### Scenario: Several scratch buffers at once

- **WHEN** the user creates more than one scratch buffer
- **THEN** each keeps its own contents, and choosing one shows that one's
  contents in the editor

#### Scenario: A scratch buffer is edited like the program

- **WHEN** the user types an invalid statement into a scratch buffer
- **THEN** it is diagnosed inline exactly as the same statement would be in the
  program

#### Scenario: Saving while a scratch buffer is showing

- **WHEN** the user saves or shares the document while a scratch buffer is the
  one on screen
- **THEN** what is saved or shared is the program, not the scratch buffer

#### Scenario: Closing a scratch buffer

- **WHEN** the user closes a scratch buffer
- **THEN** it is discarded without a confirmation step, and the program and any
  other scratch buffers are unaffected
