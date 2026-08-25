## ADDED Requirements

### Requirement: Editing actions act on the buffer on screen

The editing actions the IDE offers outside the editor itself — undo, redo, cut,
copy, paste and find/replace — SHALL act on the buffer the user is looking at,
matching what the same actions do from the keyboard. They SHALL never act on a
buffer that is not on screen.

Where an action only makes sense for a BASIC buffer, it SHALL be unavailable
while a buffer of another kind is showing, rather than being offered and quietly
acting elsewhere.

Every editable buffer SHALL offer the same set of general editing actions, so
what the IDE can do to the text does not depend on which kind of buffer holds
it.

#### Scenario: Undo on a machine code block

- **WHEN** the user edits a code block's assembly, then invokes Undo from the
  IDE rather than the keyboard
- **THEN** the assembly reverts its last edit, and the BASIC program is
  unchanged

#### Scenario: Find on a machine code block

- **WHEN** the user invokes find/replace while a code block is showing
- **THEN** it searches that block's assembly

#### Scenario: A BASIC-only action while a block is showing

- **WHEN** a code block is showing and the user looks for an action that only
  applies to BASIC, such as renumbering
- **THEN** the action is not available to invoke

## MODIFIED Requirements

### Requirement: Disposable scratch buffers

The editor SHALL let the user create scratch buffers: additional BASIC buffers,
held alongside the program, for writing code that is not part of the program
itself. The user SHALL be able to hold several at once, choose which one the
editor shows, rename one, and close one without being asked to confirm.

A scratch buffer SHALL offer the same editing the program does — the active
dialect's highlighting, completion, inline diagnostics and line-number
management — since it holds the same kind of code.

Editing a scratch buffer SHALL NOT alter the program, and SHALL NOT mark the
document as having unsaved changes. What the document builds, runs, shares or
exports SHALL be the program, never a scratch buffer, whichever buffer the editor
is showing; a saved project carries its buffers alongside that program without
changing it. Which buffer the editor is showing SHALL be apparent to the user.

Each buffer SHALL carry its own edit history. Undo and redo SHALL only ever move
a buffer through its own edits, never bring another buffer's text into it, and
the history SHALL survive showing a different buffer and coming back. Choosing
which buffer to show SHALL NOT itself be an edit, and SHALL NOT be undoable.

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
- **THEN** the program is what is shared, and what is saved is the program
  together with the scratch buffers held beside it — never the scratch buffer in
  the program's place

#### Scenario: Closing a scratch buffer

- **WHEN** the user closes a scratch buffer
- **THEN** it is discarded without a confirmation step, and the program and any
  other scratch buffers are unaffected

#### Scenario: Undo straight after switching buffers

- **WHEN** the user shows a scratch buffer and immediately undoes
- **THEN** nothing is taken from the program: the scratch buffer either undoes
  one of its own edits or has nothing left to undo, and the program keeps its
  text

#### Scenario: A buffer's history outlives showing another

- **WHEN** the user edits the program, shows a scratch buffer, then shows the
  program again and undoes
- **THEN** the program's own last edit is undone
