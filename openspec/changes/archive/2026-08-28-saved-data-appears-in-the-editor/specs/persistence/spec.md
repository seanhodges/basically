## MODIFIED Requirements

### Requirement: Programs can save and load their own files

When a running program performs data file I/O the machine can intercept, the
files SHALL be captured and served back to the program's subsequent loads.

Each captured file SHALL be shown to the user in the editor, alongside the
program, as soon as the program writes it, and SHALL be updated there as the
program writes it again. A file SHALL outlive the run that wrote it, so that
stopping the machine to read what a program produced does not destroy it.

Captured files SHALL be discarded when the program is run again, when the
machine is reset, when the target machine changes, and whenever a different
program becomes active — so a run is never served, and the user is never shown,
the leftovers of a program that is no longer open. A run therefore starts clean,
as it does today.

Captured files SHALL NOT be part of the document: they SHALL NOT be autosaved,
SHALL NOT be written into a saved project, SHALL NOT be carried by a share link
or any export, and a program writing them SHALL NOT mark the document as having
unsaved changes. They do not survive reloading the IDE.

The user SHALL be able to download any captured file individually, both as its
raw bytes and as text rendered through the machine's own character set — the
latter because on several machines a program's file output is text.

Where a machine stores a captured file inside a container of its own — a tape
image carrying a header ahead of the data — what the user is shown and what they
download SHALL be the file the program saved, not the container around it.

#### Scenario: Program round-trips its data

- **WHEN** a running program saves a data file and later loads it back
- **THEN** the program receives exactly the data it saved

#### Scenario: A saved file appears while the program runs

- **WHEN** a running program saves a data file
- **THEN** that file is shown in the editor under the name the program gave it,
  without the user opening anything

#### Scenario: A saved file survives the machine stopping

- **WHEN** a program saves a data file and the user then stops the machine
- **THEN** the file is still shown, and can still be read and downloaded

#### Scenario: Running again discards the last run's files

- **WHEN** the user runs the program again after a previous run saved files
- **THEN** those files are gone, and only what this run saves is shown

#### Scenario: Opening a different program discards them

- **WHEN** the user creates, opens, imports or loads a different program while
  captured files are shown
- **THEN** the files are discarded with the program they belonged to

#### Scenario: Saved files are not part of the document

- **WHEN** a program saves data files and the user then saves the project,
  shares it, or reloads the IDE
- **THEN** the saved project and the share link contain no captured files, and
  none return after the reload

#### Scenario: Running a program leaves the document unchanged

- **WHEN** a program that saves data files is run against an unmodified document
- **THEN** the document is still reported as having no unsaved changes

#### Scenario: A captured file is downloaded as text

- **WHEN** the user downloads a captured file as text
- **THEN** its bytes are rendered through the machine's own character set

#### Scenario: A block saved under the old kind name reopens unchanged

- **WHEN** the user opens a project, autosave or share link saved before blocks
  distinguished memory from files, holding a block recorded as data
- **THEN** it opens as a block of memory at the address it was saved with, with
  its bytes unchanged
