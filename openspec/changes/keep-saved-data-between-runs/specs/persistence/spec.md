## MODIFIED Requirements

### Requirement: Programs can save and load their own files

When a running program performs data file I/O the machine can intercept, the
files SHALL be captured and served back to the program's subsequent loads.

Each captured file SHALL be shown to the user in the editor, alongside the
program, as soon as the program writes it, and SHALL be updated there as the
program writes it again. A file SHALL outlive the run that wrote it, so that
stopping the machine to read what a program produced does not destroy it.

A file SHALL be kept for the machine that wrote it and served back to that
machine's later runs, so a program can read on one run what it saved on an
earlier one — including a run in a later session, after the IDE has been
reloaded. Neither starting a program nor resetting the machine SHALL discard the
files, and the files SHALL be shown again when the IDE reopens, without the user
having to run anything.

Only the machine that wrote a file SHALL be served or shown it. Captured files
SHALL be discarded when the target machine changes, whenever a different program
becomes active, and when the user discards one — so the user is never served,
and never shown, the files of a machine or a program that is no longer open.

What the IDE hands the machine for a program to load — the document's own memory
blocks and the tape files imported with it — SHALL NOT be kept: it is the
document going in, given to the machine afresh on every run, and SHALL never
reappear as though the program had written it.

Captured files SHALL NOT be part of the document: they SHALL NOT be autosaved,
SHALL NOT be written into a saved project, SHALL NOT be carried by a share link
or any export, and a program writing them SHALL NOT mark the document as having
unsaved changes.

A program run from a share link SHALL NOT have its files kept, and SHALL NOT
discard the files the IDE holds: opening someone else's program is not a way to
lose your own data.

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

#### Scenario: A later run reads what an earlier run saved

- **WHEN** the user runs a program that loads a file a previous run saved
- **THEN** the program receives the bytes that run saved, and the file is still
  shown

#### Scenario: Resetting the machine keeps the files

- **WHEN** the user resets the machine after a run saved files
- **THEN** the files are still shown, and the program can still load them

#### Scenario: Saved files survive reopening the IDE

- **WHEN** the user reloads the IDE after a run saved files
- **THEN** the files are shown again for that machine, and a run can load them

#### Scenario: Files are kept per machine

- **WHEN** the user switches to a different target machine after a run saved
  files
- **THEN** those files are neither shown nor served on the new machine

#### Scenario: Opening a different program discards them

- **WHEN** the user creates, opens, imports or loads a different program while
  captured files are shown
- **THEN** the files are discarded with the program they belonged to

#### Scenario: What the IDE mounted is not kept

- **WHEN** the user runs a program whose document carries memory blocks or
  imported tape files, and then runs it again or reopens the IDE
- **THEN** those are given to the machine afresh, and none of them is shown as a
  file the program saved

#### Scenario: Saved files are not part of the document

- **WHEN** a program saves data files and the user then saves the project or
  shares it
- **THEN** the saved project and the share link contain no captured files

#### Scenario: A shared program does not disturb the user's files

- **WHEN** the user opens a share link and runs the program it carries
- **THEN** what that program saves is not kept, and the files the IDE holds for
  the user's own machines are untouched

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
