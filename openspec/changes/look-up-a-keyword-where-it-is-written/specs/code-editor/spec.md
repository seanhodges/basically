## ADDED Requirements

### Requirement: Look up a keyword in the language reference

The editor SHALL let the user pick a keyword, function name or operator in the program —
by clicking or tapping it where it is written — and from there open the active machine's
language reference showing that keyword. While editing a machine-code block, the editor
SHALL offer the same for an instruction or assembler directive, opening the reference for
that block's processor.

What the editor offers SHALL follow the active machine's own reading of the program text.
Only what that machine reads as a keyword, function, operator or instruction SHALL be
offered; a line number, a number, a variable name, a processor register, text inside a
string literal and text inside a comment SHALL NOT be. Punctuation that separates the
parts of a line SHALL NOT be offered, having nothing to look up.

A keyword written in one of the machine's short spellings — the Acorns' dotted prefix,
the Commodores' shifted letter, a symbol standing for a whole command — SHALL be offered
as the keyword it stands for on that machine, and SHALL open the reference at that
keyword rather than at the spelling. The reference SHALL open at the picked keyword even
where a porting comparison is current, since the user has named what they want to read.

#### Scenario: Looking up a keyword

- **WHEN** the user picks a keyword in their program and takes up the reference offer
- **THEN** the documentation opens at the active machine's reference, showing that
  keyword

#### Scenario: Looking up an operator

- **WHEN** the user picks one of the machine's own operators
- **THEN** the reference offer is made for it, as it is for a keyword

#### Scenario: Looking up a machine-code instruction

- **WHEN** the user picks an instruction or an assembler directive while editing a
  machine-code block
- **THEN** the documentation opens at the reference for that block's processor, showing
  that instruction

#### Scenario: A keyword typed in a short spelling

- **WHEN** the user picks a keyword written in one of the machine's short spellings, as
  a listing prints it
- **THEN** the documentation opens at the keyword that spelling stands for on this
  machine

#### Scenario: Text that is not a keyword

- **WHEN** the user picks a word inside a string literal or a comment, a line number, a
  variable name, or punctuation separating the parts of a line
- **THEN** no reference offer is made

#### Scenario: A keyword lookup while a porting comparison is current

- **WHEN** a porting comparison is current for the open program and the user picks a
  keyword and takes up the reference offer
- **THEN** the documentation opens at that keyword rather than at the comparison

### Requirement: Short spellings are read as the keywords they are

Where a machine lets a program spell a keyword short, the editor SHALL read such a
spelling as that keyword throughout: it SHALL be coloured as the keyword it stands for
rather than as a name or as punctuation, and the letters that make it up SHALL NOT be
reported as a variable.

Which spellings a machine accepts, and which keyword each stands for, SHALL follow that
machine's own resolution order rather than a shared rule — a prefix takes the first
keyword its ROM scans that begins with it, and a prefix that spells a whole keyword is
that keyword rather than an abbreviation.

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

### Requirement: One menu for what the picked text can answer

Where picking a token in the program can answer more than one question about it, the
editor SHALL present those offers together in one menu, opened where the token is
written. A question the picked token cannot answer SHALL NOT be offered.

The menu SHALL be dismissible by Escape while it is open, and that keypress SHALL NOT
also dismiss whatever surface stands behind the editor.

#### Scenario: The offers a variable can answer

- **WHEN** the user picks a variable
- **THEN** the menu offers to show where that variable is used, and makes no reference
  offer

#### Scenario: The offers a keyword can answer

- **WHEN** the user picks a keyword
- **THEN** the menu offers the language reference, and does not offer to show usages

#### Scenario: Dismissing the menu

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes, and nothing behind it is dismissed by the same keypress
