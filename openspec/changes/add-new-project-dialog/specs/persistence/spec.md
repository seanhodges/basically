## MODIFIED Requirements

### Requirement: Autosave protects work in progress

The IDE SHALL automatically persist the working document — source, name, and
every document-model part (blocks, tape files, auto-start, boot disc) — every
few seconds while it has unsaved changes, and restore it on the next launch.
Pristine sample programs SHALL NOT be restored as if they were user work, except
where the user named the project when creating it: a name the user chose is
itself work, and SHALL be preserved along with the document it names.

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
