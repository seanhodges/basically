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

#### Scenario: Preferences survive reload

- **WHEN** the user changes settings and reloads the IDE
- **THEN** the same settings are in effect

### Requirement: Programs can save and load their own files

When a running program performs data file I/O the machine can intercept, the
files SHALL be captured per session, served back to the program's subsequent
loads, and be inspectable by the user. These files are session-scoped: a new
run starts clean.

#### Scenario: Program round-trips its data

- **WHEN** a running program saves a data file and later loads it back
- **THEN** the program receives exactly the data it saved

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

