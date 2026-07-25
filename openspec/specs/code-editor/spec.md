# code-editor Specification

## Purpose

Give every dialect a first-class BASIC editing experience from one generic
editor: authentic keyword highlighting, dialect-aware completion, inline
diagnostics as you type, and line-number management — all driven by the
active dialect's own data, with no per-machine editor code.

## Requirements

### Requirement: Dialect-aware highlighting and completion

The editor SHALL highlight the active dialect's keywords and offer completion
for its keywords, the program's own variables, and common statement
constructs. For dialects whose machines ignore spacing when tokenizing, the
editor SHALL recognise keywords the same way the machine would (e.g. keywords
embedded in identifier runs).

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

### Requirement: Inline diagnostics while typing

The editor SHALL run the dialect's linter as the user types (debounced) and
display each error inline at its line and column, without a manual check
step.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

### Requirement: The RAM budget is always visible

The IDE SHALL continuously show the tokenized program's byte size against the
machine's available program RAM, so the user can see headroom before running.

#### Scenario: Growing program

- **WHEN** the user adds lines to the program
- **THEN** the byte counter updates to reflect the new tokenized size

### Requirement: Line-number management

The editor SHALL support automatic line numbering while typing and a
renumbering command that rewrites line numbers (and, where the dialect uses
them, line-number references) consistently.

#### Scenario: Renumber a program

- **WHEN** the user renumbers a program
- **THEN** lines are renumbered in even increments and remain in the same
  order, and the program still tokenizes cleanly

### Requirement: Opaque binary lines display as chips

On dialects that support opaque binary line records, the editor SHALL
collapse each record to a compact chip rather than exposing raw encoded text,
while keeping the record intact in the underlying document.

#### Scenario: Imported program with machine code

- **WHEN** the user imports a program containing binary line records
- **THEN** each record shows as a chip in the editor and the program still
  runs with its machine code intact

### Requirement: Program structure at a glance

The editor SHALL offer an outline of the program's structure (such as
procedures, subroutines, or jump targets appropriate to the dialect) that the
user can navigate from.

#### Scenario: Jump from the outline

- **WHEN** the user picks an entry in the program outline
- **THEN** the editor moves the cursor to that line
