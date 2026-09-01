# persistence Specification

## Purpose

Never lose the user's work, and keep everything local: continuous autosave in
the browser, a self-describing project bundle on disk, durable settings, and
a window into the files a running program writes.
## Requirements
### Requirement: Autosave protects work in progress

The IDE SHALL automatically persist the working document — source, name, and
every document-model part (blocks, tape files, auto-start, boot disc) — every
few seconds while it has unsaved changes, and restore it on the next launch.
Pristine sample programs SHALL NOT be restored as if they were user work, except
where the user named the project when creating it and has not since edited it:
a name they chose is itself work, and SHALL be preserved along with the document
it names. Emptying the editor SHALL remain the way to make the IDE forget a
program, whether or not that program had a name.

#### Scenario: Crash recovery

- **WHEN** the browser closes without saving and the user reopens the IDE
- **THEN** the document is restored as it last was, including its blocks

#### Scenario: A named project keeps its name

- **WHEN** the user creates a named project and reopens the IDE without having
  edited it
- **THEN** the project is restored under the name they gave it

#### Scenario: An untitled, untouched document is not restored

- **WHEN** the user creates an unnamed project from a sample, does not edit it,
  and reopens the IDE
- **THEN** nothing is restored as if it were their own work

#### Scenario: A deliberately cleared program stays cleared

- **WHEN** the user empties the editor of a program that had a name, and
  reopens the IDE
- **THEN** that program is not restored

### Requirement: Documents save as an open project bundle

Saving SHALL write a zip bundle whose parts are plain files (the BASIC
source, each block's bytes and assembly, and a metadata file), so the pieces
are usable outside the IDE. Opening SHALL accept the bundle and plain source
files, and a bundle SHALL round-trip losslessly through save and open.

#### Scenario: Bundle round-trip

- **WHEN** the user saves a document with blocks and reopens the bundle
- **THEN** the restored document equals the saved one

### Requirement: Settings persist locally

Every user preference (target machine, editor, emulator, input, AI provider
and per-provider keys) SHALL persist in the browser across sessions, and
SHALL never leave the browser except where the setting's purpose is to be
sent (an API key to its own provider).

How the user last left the machine list — the text it was narrowed by and the
arrangement it was in — SHALL persist on the same terms, so that reopening the
list after a reload shows what reopening it before the reload showed.

#### Scenario: Preferences survive reload

- **WHEN** the user changes settings and reloads the IDE
- **THEN** the same settings are in effect

#### Scenario: The machine list is remembered as it was left

- **WHEN** the user narrows and rearranges the machine list, then reloads the
  IDE
- **THEN** the list opens narrowed and arranged the same way

### Requirement: Programs can save and load their own files

When a running program performs data file I/O the machine can intercept, the
files SHALL be captured and served back to the program's subsequent loads.

Each captured file SHALL be shown to the user in the editor, alongside the
program, as soon as the program writes it, and SHALL be updated there as the
program writes it again. A file SHALL outlive the run that wrote it, so that
stopping the machine to read what a program produced does not destroy it.

A file SHALL be kept for the machine that wrote it and served back to that
machine's later runs, so a program can read on one run what it saved on an
earlier one — including a run after the IDE has been reloaded. Neither starting
a program nor resetting the machine SHALL discard the files, and the files SHALL
be shown again when the IDE reloads, without the user having to run anything.

Only the machine that wrote a file SHALL be served or shown it. Captured files
SHALL be discarded when the target machine changes, whenever a different program
becomes active, and when the user discards one — so the user is never served,
and never shown, the files of a machine or a program that is no longer open.

A file SHALL belong to the browser tab whose program produced it, as that tab's
document already does. A second tab of the IDE SHALL be neither served nor shown
another tab's files, whatever machine it is running, and nothing it does SHALL
discard them: two tabs SHALL be able to run programs that write the same file
name without either one disturbing the other. Files SHALL NOT outlive the tab
that produced them indefinitely; once a tab is gone, what it wrote MAY be
reclaimed.

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

#### Scenario: Saved files survive reloading the IDE

- **WHEN** the user reloads the IDE in the tab where a run saved files
- **THEN** the files are shown again for that machine, and a run can load them

#### Scenario: Another browser tab keeps its own files

- **WHEN** the user opens the IDE in a second browser tab and runs a program
  there that saves a file under a name the first tab's program also used
- **THEN** each tab is shown and served only its own file, and neither tab's
  files are changed or discarded by the other

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

### Requirement: The user can supply their own machine ROM

For a machine whose emulation runs the ROM image the IDE gives it, the user
SHALL be able to install a ROM image of their own in place of the bundled one,
and SHALL be able to return to the bundled image at any time.

An image SHALL be accepted whatever its size. Where its size differs from the
size that machine's ROM area holds, the image SHALL be fitted to that area —
a smaller image padded as unprogrammed ROM, a larger one used from its leading
bytes — and the IDE SHALL report which happened alongside the size of the file
itself, so a user who supplied one half of a two-bank image can see that is what
happened. The IDE SHALL NOT state a size an image is required to have.

An installed image SHALL persist across sessions, SHALL apply wherever that
machine runs in that browser — including the standalone player — and SHALL
never leave the browser. It SHALL NOT be carried in a published share link: a
recipient runs the bundled image unless they have installed one themselves.

A machine whose emulation loads its own ROM set, and would therefore ignore a
supplied image, SHALL say so rather than offer a replacement that would have no
effect.

When an installed image cannot be stored, the user SHALL be told, and SHALL NOT
be left believing it was kept.

#### Scenario: A supplied ROM survives a reload

- **WHEN** the user installs their own ROM image for a machine and reopens the
  IDE
- **THEN** that machine still runs the image they supplied

#### Scenario: A file of any size is accepted and fitted

- **WHEN** the user offers a file whose size differs from the machine's ROM size
- **THEN** the image is installed and the IDE reports the file's own size and
  that it was padded, or trimmed, to fit the machine

#### Scenario: The bundled ROM can be restored

- **WHEN** the user restores the bundled ROM for a machine they had supplied
  their own image for
- **THEN** that machine runs the bundled image again, and the IDE reports that
  it is in use

#### Scenario: A machine that loads its own ROM set offers no replacement

- **WHEN** the user looks at the ROM setting for a machine whose emulation
  resolves its own ROM images
- **THEN** they are told it cannot be replaced, and are offered no control that
  would appear to replace it

#### Scenario: A ROM that cannot be stored says so

- **WHEN** an image the user supplies cannot be stored in the browser
- **THEN** they are told it was not kept, rather than the IDE reporting success

### Requirement: Works offline

Once installed, the IDE SHALL launch and operate offline: previously used
machines (including their ROMs) remain runnable, and only inherently
networked features (AI, sharing) require connectivity.

A ROM image the user supplied themselves SHALL be available offline from the
moment it is installed, without that machine having been run while connected.

#### Scenario: Offline relaunch

- **WHEN** the user launches the installed app without a network connection
- **THEN** they can edit and run programs on machines they have used before

#### Scenario: Offline on a machine whose ROM the user supplied

- **WHEN** the user installs their own ROM image for a machine they have never
  run, and then launches the app without a network connection
- **THEN** that machine runs

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

### Requirement: A machine that cannot capture a program's files says so

Not every machine intercepts the file I/O a running program performs. Whether a
machine does SHALL be a declared property of that machine, true of exactly those
whose emulation actually intercepts it.

Where a machine does not intercept, the IDE SHALL say so wherever a program's
captured files are presented, rather than presenting an emptiness that reads as a
program having saved nothing. The two cases SHALL be distinguishable: a machine
that captures files and has none yet is not the same as a machine that never
could.

A machine's declaration SHALL NOT be taken on trust. A machine that claims to
capture a program's files SHALL be held to it by running a program that saves one
and reads it back.

#### Scenario: A machine with no traps explains the empty list

- **WHEN** the user views a program's captured files on a machine whose emulation
  does not intercept file I/O
- **THEN** the IDE states that this machine does not capture the files a program
  saves

#### Scenario: A machine with traps and nothing saved yet shows an empty list

- **WHEN** the user views a program's captured files on a machine that does
  intercept file I/O, and the program has saved none
- **THEN** the IDE presents an empty list, and does not claim the machine is
  incapable

#### Scenario: A machine is held to what it claims

- **WHEN** a machine declares that it captures the files a program saves
- **THEN** a program run on that machine that saves a data file and loads it back
  receives exactly the data it saved

