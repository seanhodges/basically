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

An image SHALL be accepted only when its size exactly matches the size that
machine's ROM requires. A refusal SHALL state both the size of the file offered
and the size the machine requires, so a user who supplied one half of a
two-bank image can see that is what happened.

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

#### Scenario: A wrong-sized file is refused by name

- **WHEN** the user offers a file whose size differs from the machine's ROM size
- **THEN** the file is not installed, and they are told both its size and the
  size that machine requires

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
