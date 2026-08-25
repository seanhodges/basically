## ADDED Requirements

### Requirement: The editor's variable checks follow the machine's case rule

Whether two spellings of a name are one variable or two SHALL be decided the same
way everywhere the editor answers that question — when it reports a collision
between names the machine cannot tell apart, when it highlights a name's usages,
when it offers completions, and when it renames. On a machine that tells `A` from
`a`, no two names differing only in case SHALL be reported as colliding; on a
machine that folds them, they SHALL be treated as one name throughout.

Where the editor quotes a name back to the reader, it SHALL quote the spelling
the program uses rather than a folded form of it.

#### Scenario: Two cases of a name on a machine that distinguishes them

- **WHEN** a program on a case-sensitive machine uses two names that differ only
  in letter case
- **THEN** the editor's variable checks report no collision between them, and its
  usages view treats them as two variables

#### Scenario: Two cases of a name on a machine that folds them

- **WHEN** a program on a machine that folds letter case uses two names that
  differ only in case
- **THEN** the editor treats them as one variable in its checks and its usages
  view alike

#### Scenario: A name quoted back to the reader

- **WHEN** the editor reports something about a name the program spells in lower
  case
- **THEN** it quotes the name as the program spells it

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

The editor SHALL read a word spelled in lower case as a keyword only on the
machines that would read it as one. Where a machine would not — its encoding
preserves lower case and its ROM matches keywords by character — the word SHALL
be treated as a variable name throughout: coloured as a name, offered among the
program's variables, listed in its structure, and renamed with it. The editor
SHALL NOT colour a word as a keyword while its checks report the same word as
something else.

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

#### Scenario: A lower-case keyword on a machine that reads it as a name

- **WHEN** a program on a machine whose ROM matches keywords by character spells
  a keyword in lower case
- **THEN** it is coloured as a variable name rather than as a keyword, and it
  appears among the program's variables and in its structure

#### Scenario: A lower-case keyword on a machine that reads it as a keyword

- **WHEN** a program on a machine whose encoding folds lower case, or whose ROM
  accepts either case, spells a keyword in lower case
- **THEN** it is coloured as the keyword, and it is not reported as a variable

### Requirement: Short spellings are read as the keywords they are

Where a machine lets a program spell a keyword short, the editor SHALL read such a
spelling as that keyword throughout: it SHALL be coloured as the keyword it stands for
rather than as a name or as punctuation, and the letters that make it up SHALL NOT be
reported as a variable.

Which spellings a machine accepts, and which keyword each stands for, SHALL follow that
machine's own resolution order rather than a shared rule — a prefix takes the first
keyword its ROM scans that begins with it, and a prefix that spells a whole keyword is
that keyword rather than an abbreviation.

A short spelling SHALL be read as a keyword only in the letter case its machine's own
scan accepts. On a machine that matches keywords by character, a prefix spelled in a
case the ROM would not accept is a name, and SHALL be read as one.

#### Scenario: A dotted listing

- **WHEN** the user opens a listing on a machine that abbreviates with a trailing dot,
  and it spells a command short
- **THEN** that spelling is coloured as the command, and its leading letters are not
  reported as a variable

#### Scenario: A shifted-letter listing

- **WHEN** the user opens a listing on a machine that abbreviates with a shifted letter,
  and it spells a command short before its arguments
- **THEN** the spelling is coloured as the command and what follows it is read as the
  command's arguments, rather than the whole run being read as one name

#### Scenario: A symbol standing for a whole command

- **WHEN** the program uses a symbol the machine reads as a whole command
- **THEN** it is coloured as that command, and where the command is a comment marker the
  rest of the line is coloured as a comment

#### Scenario: A prefix that spells a whole keyword

- **WHEN** a prefix that could abbreviate a longer keyword is itself a whole keyword on
  this machine
- **THEN** it is read as the whole keyword it spells, not as the abbreviation

#### Scenario: A short spelling in a case the machine would not accept

- **WHEN** a program on a machine that matches keywords by character spells an
  abbreviation in lower case
- **THEN** it is read as a name rather than as the keyword it would abbreviate in
  upper case
