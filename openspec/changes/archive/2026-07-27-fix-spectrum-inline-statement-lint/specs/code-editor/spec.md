## MODIFIED Requirements

### Requirement: Inline diagnostics while typing

The editor SHALL run the dialect's linter as the user types (debounced) and
display each error inline at its line and column, without a manual check step.

Where the active dialect's machine allows several statements on one line, the
linter SHALL apply its statement checks to every statement on the line, not
only the first, including a statement introduced by a conditional's `THEN`.

A diagnostic's reported position SHALL account for any leading whitespace on
the line, so an indented line's errors are marked at the characters they
actually refer to.

A statement-shape diagnostic — a report that a statement does not open the way
the machine requires — SHALL NOT by itself prevent the program from being built
or exported, since the machine would store such a line and object only when it
runs.

#### Scenario: Error appears and clears

- **WHEN** the user types an invalid statement and then corrects it
- **THEN** an inline diagnostic appears at the offending position and
  disappears once corrected

#### Scenario: A bad statement after a separator

- **WHEN** the user writes a line whose first statement is valid but whose
  second statement, after the machine's statement separator, does not open with
  a valid statement keyword
- **THEN** an inline diagnostic marks that second statement

#### Scenario: A valid multi-statement line is clean

- **WHEN** the user writes a line of several valid statements separated by the
  machine's separator, including empty statements and a trailing separator
- **THEN** no diagnostic is reported for that line

#### Scenario: An indented line marks the right characters

- **WHEN** an invalid statement appears on a line that begins with whitespace
- **THEN** the diagnostic is positioned at the offending token, not displaced
  by the width of the indent

#### Scenario: A statement-shape error still runs

- **WHEN** a program's only diagnostics are statement-shape reports
- **THEN** the program still builds a runnable image and can still be exported
  to hardware
