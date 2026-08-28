## ADDED Requirements

### Requirement: A saved data file can be copied into a block

From a file a running program saved, the user SHALL be able to make a block of
memory holding a copy of that file's bytes, without leaving the IDE and without
routing the bytes through a download. The bytes copied SHALL be the file the
program saved, not any container the machine wrapped around it — what the user
was shown is what the block holds.

The new block SHALL be part of the document like any other: named, at an
address, autosaved, saved, shared, checked before a run and loaded into memory
with the program. Because the address it starts at is a suggestion rather than a
choice the user has made, its settings SHALL be open on it as soon as it is
made, so the name and load address can be corrected before anything else
happens; a placement that conflicts with another block SHALL be reported as any
other conflicting placement is.

The file SHALL be unaffected by the copy: still readable by the running program,
still shown as its own tab, and still discarded when a run, a reset, a machine
change or a different program discards it. Copying SHALL NOT make the file part
of the document, and a block SHALL NOT be convertible back into a file.

#### Scenario: The copy holds the file's bytes

- **WHEN** the user copies a saved data file into a block
- **THEN** a block exists holding exactly the bytes that file's tab showed

#### Scenario: The block's settings open on it

- **WHEN** the user copies a saved data file into a block
- **THEN** that block's tab is shown with its settings open, so its name and
  load address can be set straight away

#### Scenario: The file survives the copy

- **WHEN** the user copies a saved data file into a block
- **THEN** the file is still shown as its own tab and the running program can
  still load it

#### Scenario: The block outlives the file

- **WHEN** the user copies a saved data file into a block and then runs the
  program again
- **THEN** the file is discarded with the last run's output and the block is
  still part of the document

### Requirement: A block can be created as either kind

Creating a block SHALL offer both of the kinds a block can be — machine code
edited as assembly, and a block of memory edited as bytes — so a block of data
is made as one rather than made as code and converted. A block created as memory
SHALL open on its bytes and carry no assembly source; a block created as code
SHALL open on its assembly, as it does today.

#### Scenario: A block created as memory

- **WHEN** the user creates a new block of memory
- **THEN** it opens in the byte editor, with no assembly source of its own

#### Scenario: A block created as code

- **WHEN** the user creates a new machine code block
- **THEN** it opens in the assembly editor, as it did before either kind could
  be created directly
