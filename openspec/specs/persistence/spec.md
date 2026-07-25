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

### Requirement: Works offline

Once installed, the IDE SHALL launch and operate offline: previously used
machines (including their ROMs) remain runnable, and only inherently
networked features (AI, sharing) require connectivity.

#### Scenario: Offline relaunch

- **WHEN** the user launches the installed app without a network connection
- **THEN** they can edit and run programs on machines they have used before
