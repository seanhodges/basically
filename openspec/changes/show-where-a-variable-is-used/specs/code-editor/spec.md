## ADDED Requirements

### Requirement: Find a variable's usages

The editor SHALL let the user pick a variable in the program — by clicking or
tapping it where it is written — and from there see every place that variable is
used. The usages SHALL be highlighted in the text, counted, and navigable, and
the user SHALL be able to dismiss them.

Which occurrences count SHALL follow the active machine rather than the
spelling:

- names SHALL be matched without regard to letter case on the machines whose
  ROM folds it, and with regard to it on the machines that distinguish it;
- on a machine whose ROM keeps only a limited number of a name's characters,
  names the machine cannot tell apart SHALL be reported as one variable;
- a scalar and an array of the same name SHALL be reported as different
  variables, as the machine holds them separately;
- a name that is local to a procedure SHALL be reported only within that
  procedure, and a global name spelled the same SHALL NOT include that
  procedure's local occurrences.

Keyword spellings, text inside string literals and comment text SHALL NOT be
counted as usages of a variable. A word inside a `DATA` statement SHALL be
counted only on the machines whose ROM evaluates its items, and SHALL NOT be on
the machines that take them literally.

Usages SHALL be found in the buffer the editor is showing.

#### Scenario: Seeing where a variable is used

- **WHEN** the user picks a variable that the program uses in several places
- **THEN** every one of those places is highlighted and the user is told how
  many there are

#### Scenario: Stepping between usages

- **WHEN** the user asks for the next usage
- **THEN** the editor brings that usage into view and moves the cursor to it,
  continuing from the last usage back to the first

#### Scenario: Letters that are not a variable

- **WHEN** the picked variable's letters also occur inside a keyword, inside a
  string literal, and inside a comment
- **THEN** none of those are highlighted or counted

#### Scenario: A word inside DATA

- **WHEN** the program uses the picked variable's name inside a `DATA`
  statement
- **THEN** it is highlighted only if the machine evaluates its `DATA` items,
  and not if the machine takes them literally

#### Scenario: The same name in a different case

- **WHEN** the program spells the picked variable's name in another letter case
- **THEN** it is highlighted only if the machine treats the two as one
  variable

#### Scenario: Names the machine cannot tell apart

- **WHEN** the user picks a variable on a machine whose ROM keeps only the
  first two characters of a name, and the program also uses a differently
  spelled name that collapses to the same one
- **THEN** both spellings are highlighted, because the machine holds them as a
  single variable

#### Scenario: A name that belongs to a procedure

- **WHEN** the user picks a name that is a procedure's parameter or local
  variable, and the same spelling is also used outside that procedure
- **THEN** only the occurrences inside that procedure are highlighted

#### Scenario: An array and a scalar of the same name

- **WHEN** the user picks an array element, and the program also uses a plain
  variable spelled the same
- **THEN** only the array's occurrences are highlighted

#### Scenario: Dismissing the usages

- **WHEN** the user dismisses the usages, or edits the program
- **THEN** the highlights are removed

## MODIFIED Requirements

### Requirement: Dialect-aware highlighting and completion

The editor SHALL highlight the active dialect's keywords and offer completion
for its keywords, the program's own variables, and common statement
constructs. For dialects whose machines ignore spacing when tokenizing, the
editor SHALL recognise keywords the same way the machine would (e.g. keywords
embedded in identifier runs).

The editor SHALL treat the items of a `DATA` statement the way the dialect's
machine does: as variables where the machine evaluates them, and as values —
never names — where it takes them literally.

#### Scenario: Crunched keyword recognised

- **WHEN** the user types a statement with no spaces on a dialect whose
  machine matches keywords greedily
- **THEN** the embedded keywords are highlighted as the machine would read
  them

#### Scenario: DATA items on a machine that takes them literally

- **WHEN** a program lists unquoted words as the items of a `DATA` statement on
  a dialect whose machine READs those items literally
- **THEN** those words are not offered as variable completions and are not
  reported by the editor's variable checks

#### Scenario: DATA items on a machine that evaluates them

- **WHEN** a program names a variable inside a `DATA` statement on a dialect
  whose machine evaluates those items
- **THEN** that name is treated as a use of the variable, offered as a
  completion and checked like any other
