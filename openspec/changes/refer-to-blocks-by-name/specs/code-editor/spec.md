## MODIFIED Requirements

### Requirement: Dialect-aware highlighting and completion

The editor SHALL highlight the active dialect's keywords and offer completion
for its keywords, the program's own variables, and common statement
constructs. For dialects whose machines ignore spacing when tokenizing, the
editor SHALL recognise keywords the same way the machine would (e.g. keywords
embedded in identifier runs).

Where a document has memory blocks, the editor SHALL also complete their names —
both where a reference to a block is being written, and after the keyword that
machine uses to call machine code — showing each block's address, size and
comment so the user can tell them apart.

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

#### Scenario: Block names complete after the call keyword

- **WHEN** the user types the machine's machine-code call keyword in a document
  that has blocks
- **THEN** the blocks are offered by name, with their addresses

### Requirement: Inline diagnostics while typing

The editor SHALL run the dialect's linter as the user types (debounced) and
display each error inline at its line and column, without a manual check step.

Where the active dialect's machine allows several statements on one line, the
linter SHALL apply its statement checks to every statement on the line, not
only the first, including a statement introduced by a conditional's `THEN`.

A diagnostic's reported position SHALL account for any leading whitespace on
the line, so an indented line's errors are marked at the characters they
actually refer to.

A diagnostic's reported position SHALL likewise account for any block reference
the IDE resolved before linting, so an error on a line that names a block is
marked at the characters the user typed rather than at the address they stood
for.

A statement-shape diagnostic — a report that a statement does not open the way
the machine requires — SHALL NOT by itself prevent the program from being built
or exported, since the machine would store such a line and object only when it
runs.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

#### Scenario: A diagnostic on a line naming a block lands correctly

- **WHEN** the user makes a mistake on a line that also refers to a block by
  name
- **THEN** the diagnostic is marked at the characters they typed
