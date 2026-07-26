## ADDED Requirements

### Requirement: BASIC dialect variants are honoured per machine

Where registered machines run different versions of the same BASIC, each
machine's toolchain SHALL accept exactly the keywords that machine's BASIC
provides. A keyword introduced by a later version SHALL be usable on the
machines that have it and SHALL be reported as an error, at its line and
column, on the machines that do not — rather than being silently accepted,
silently dropped, or tokenized to a byte the machine cannot run. Source using
only the shared, earlier version of the language SHALL produce equivalent
program bytes on every machine in that family.

#### Scenario: A later-version keyword on a machine that has it

- **WHEN** the user writes a keyword introduced by a later version of the
  machine's BASIC, with that machine selected as the target
- **THEN** the program tokenizes without error and runs on the emulator

#### Scenario: The same keyword on an earlier machine in the family

- **WHEN** the user writes that same keyword with an earlier machine of the
  same BASIC family selected as the target
- **THEN** an error identifies the line and column, and the keyword is not
  tokenized

#### Scenario: Shared-version source is portable within the family

- **WHEN** the user writes a program using only keywords common to every
  version of that BASIC
- **THEN** tokenizing it against any machine in the family yields equivalent
  program bytes

#### Scenario: Reference documentation marks version-only keywords

- **WHEN** the user consults the language reference for a BASIC family whose
  machines run different versions
- **THEN** each keyword that only some of those machines provide is marked with
  the version that introduced it
