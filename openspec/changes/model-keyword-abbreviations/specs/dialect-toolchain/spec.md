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
