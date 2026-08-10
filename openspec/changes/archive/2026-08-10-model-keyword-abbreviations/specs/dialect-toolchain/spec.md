## ADDED Requirements

### Requirement: Commodore shifted-letter abbreviations tokenize to the keyword

The Commodore machines' own tokenizer lets a keyword be typed as a prefix
ending in a shifted letter — `pO` for `POKE`, `gO` for `GOTO` — resolved to
the first word in the machine's reserved-word order that the prefix and
letter begin. Archive listings use this notation throughout, and a program
pasted from one must mean what it meant on the machine.

On the Commodore machines, tokenizing SHALL accept a shifted-letter
abbreviation and produce the same token the full spelling produces, resolved
in the machine's own reserved-word order. Keywords spelled in full SHALL keep
tokenizing exactly as they do today, whatever their case, so the abbreviation
reading applies only where no full spelling matches. Each machine SHALL
resolve against its own keyword table.

Listing a program back SHALL expand abbreviations to the full spelling, as
the machines' own LIST does; the abbreviation is entry notation, not stored
text.

An abbreviation inside a string, a comment, or data SHALL NOT be read as a
keyword, as full-spelling keywords are not.

#### Scenario: A magazine listing pastes correctly

- **WHEN** a program containing `pO53280,0` is tokenized for a Commodore
  machine
- **THEN** the line produces the same bytes as `POKE53280,0`

#### Scenario: Resolution follows the machine's word order

- **WHEN** an abbreviation's prefix and shifted letter begin more than one of
  the machine's keywords
- **THEN** it resolves to the first in the machine's own reserved-word order,
  as the machine itself resolves it

#### Scenario: Full spellings are unchanged

- **WHEN** a program spells its keywords in full, in any mix of case
- **THEN** it tokenizes exactly as it did before abbreviations were accepted

#### Scenario: Listing expands

- **WHEN** a program entered with abbreviations is listed back
- **THEN** every keyword appears in its full spelling

#### Scenario: An abbreviation inside a string

- **WHEN** a string literal or comment contains text shaped like an
  abbreviation
- **THEN** it is kept as text, not read as a keyword

### Requirement: The language reference notes and finds a keyword's short spellings

A reader consulting a reference page has usually arrived from a listing, and a
listing spells keywords the way they were typed. Someone reading `P.` or `?`
needs the page to answer *what is this*, which a table indexed only by canonical
spelling cannot do.

Every BASIC reference page SHALL show, against each keyword, the short spellings
the machine accepts for it — the abbreviated prefix, the symbol standing for the
whole command, or both where the machine has both. A keyword the machine has no
short spelling for SHALL show none, and a page whose machines have none SHALL
say nothing about spellings at all.

Searching a reference page SHALL match a keyword's short spellings as well as
its name, so a spelling copied out of a listing finds its row.

Where a page covers several machines, a spelling SHALL be shown only where every
machine that has the row reads it the same way; a machine-specific row SHALL
show its own machine's spelling.

Every spelling shown SHALL be one the machine's own tokenizer reads as that
keyword — the page states what the machine does, never a plausible spelling it
would reject or read as something else.

#### Scenario: Looking up a spelling read in a listing

- **WHEN** the user searches a reference page for a short spelling
- **THEN** the keyword it stands for is among the results

#### Scenario: Reading a keyword's own entry

- **WHEN** the user reads the entry for a keyword the machine lets them type
  short
- **THEN** the entry shows the short spellings alongside the canonical one

#### Scenario: A machine that abbreviates nothing

- **WHEN** the user reads a reference page for a machine whose keywords arrive
  by keystroke rather than as a spelling
- **THEN** no short spellings are shown or searched for

#### Scenario: A row belonging to one machine on a shared page

- **WHEN** a reference page covers several machines and a row exists on only one
  of them
- **THEN** the spelling shown is the one that machine reads
