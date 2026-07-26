# dialect-toolchain Specification

## Purpose

Guarantee a uniform text-to-bytes language toolchain for every registered
target machine: source in the editor tokenizes to authentic program bytes,
imported program bytes detokenize back to editable source, and problems are
reported inline rather than aborting. This uniform contract is what makes new
machines pluggable without changes to the rest of the IDE.
## Requirements
### Requirement: Registered dialects are the available targets

The IDE SHALL offer exactly the set of registered dialects as target machines,
and every capability in this product (editing, running, exporting, AI
assistance) SHALL work against whichever dialect is active.

#### Scenario: Switching target

- **WHEN** the user selects a different target machine
- **THEN** the editor language, keyboard, emulator, samples, and export
  options all reflect the newly selected dialect

### Requirement: Tokenization reports errors without throwing

Tokenizing source SHALL produce the program bytes, a full loadable memory
image, and the program's byte size, together with a list of errors (each
carrying a 1-based line and 0-based column). Invalid source SHALL never abort
tokenization with an exception.

#### Scenario: One bad line among good ones

- **WHEN** the user tokenizes a program in which a single line is invalid
- **THEN** an error identifies that line and column, and the other lines are
  still processed

### Requirement: Detokenization round-trips imported programs

Importing a native program image SHALL recover editable source such that
re-tokenizing that source reproduces an equivalent program. Where the text
form cannot capture everything in the image, the import SHALL report what
was lost rather than dropping it silently.

#### Scenario: Lossless import

- **WHEN** the user imports a native program image that the text form can
  fully represent
- **THEN** re-tokenizing the recovered source yields the same program bytes

#### Scenario: Lossy import is flagged

- **WHEN** an imported image contains content the text form cannot represent
- **THEN** the user is told what could not be captured

### Requirement: Charset mapping is bidirectional

Each dialect SHALL map its machine character codes to unicode (block graphics
and escape sequences) and back, so that a program written with those
characters displays faithfully in the editor and encodes correctly on the
machine.

#### Scenario: Block graphics survive the round trip

- **WHEN** the user writes a program using the dialect's block-graphic
  characters and runs it
- **THEN** the emulator screen shows the same graphics the editor showed

### Requirement: Opaque binary line records are preserved

For dialects that support them, opaque binary program-line records embedded in
the source (the hidden machine-code trick from imported images) SHALL pass
through tokenization verbatim and SHALL survive editing operations such as
renumbering and AI merges untouched.

#### Scenario: Renumber around a binary record

- **WHEN** the user renumbers a program containing an opaque binary line
  record
- **THEN** the record's bytes are unchanged in the tokenized output

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

