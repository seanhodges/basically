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
assistance) SHALL work against whichever dialect is active. The set SHALL be
presented the same way wherever a machine is chosen, so that switching the
target machine describes the machines as fully as starting a project does.

#### Scenario: Switching target

- **WHEN** the user selects a different target machine
- **THEN** the editor language, keyboard, emulator, samples, and export
  options all reflect the newly selected dialect

#### Scenario: Switching target describes the machines

- **WHEN** the user goes to switch the target machine
- **THEN** they are offered the same grouped and described set of machines as
  when creating a project

#### Scenario: Switching target still asks about the user's program

- **WHEN** the user switches the target machine while holding code that the new
  machine cannot take as it stands
- **THEN** they are still asked what should happen to that code before the
  switch is applied

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

Where unicode provides an exact character for one of the machine's graphics
glyphs, that character SHALL be the canonical text form the dialect produces
when it renders that code. A spelling that was canonical before SHALL still be
accepted when reading a program, and SHALL encode to the same machine code, so
that no previously saved program becomes unreadable.

Where the machine shows one stored byte as either a graphics shape or a
letter depending on the display state in force when it is shown, the graphics
shape SHALL be that byte's canonical editor form. A byte's text form SHALL
NOT vary with the contents of other bytes: the editor shows one spelling, and
the program still encodes byte-exactly whichever way the machine would have
displayed it.

Where the machine draws the same graphics shape from more than one character
code, at most one of those codes SHALL use the unicode character for that
shape, so that every text form encodes back to exactly one machine code. The
remaining codes SHALL keep a text form that is distinguishable from it and
from each other, and a program using them SHALL still export and re-import
byte-exactly.

A graphics character the machine stores as one byte SHALL be one character in
the editor, including where the machine's own shape for it is undefined (the
user-defined graphics), so that editing cannot leave half of one behind.

#### Scenario: Block graphics survive the round trip

- **WHEN** the user writes a program using the dialect's block-graphic
  characters and runs it
- **THEN** the emulator screen shows the same graphics the editor showed

#### Scenario: A graphics character has one canonical form

- **WHEN** a program containing a machine graphics character that unicode can
  express exactly is rendered into the editor
- **THEN** it appears as that unicode character rather than as an escape
  sequence

#### Scenario: An older spelling still loads

- **WHEN** the user opens a program that spells a graphics character the way
  the dialect used to render it
- **THEN** the program loads, that character encodes to the same machine code
  as before, and it is shown in the canonical form

#### Scenario: A context-dependent byte keeps one spelling

- **WHEN** the user imports a program that stores a byte the machine would
  display as a letter in one display state and as a graphics shape in another
- **THEN** the editor shows the graphics shape, and exporting the program
  writes back the identical byte

#### Scenario: Two codes for one shape keep separate spellings

- **WHEN** the user imports a program using a character code that draws the
  same shape as another code on the same machine
- **THEN** it is shown in a form distinct from the other code's, and exporting
  the program writes back the identical byte rather than the other code

#### Scenario: A user-defined graphic is a single character

- **WHEN** the user inserts one of the machine's user-defined graphics and then
  deletes it with a single backspace
- **THEN** the whole graphic is removed, leaving no fragment of it in the
  program

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

### Requirement: The language reference describes arguments one way

Every BASIC reference page SHALL describe the arguments a command, function or
operator takes in one shared notation: one vocabulary of argument names, and one set
of rules for marking which arguments are optional, which alternatives are accepted,
which parts repeat, and which parts are the literal text the user types. A reader who
has learned to read one dialect's page SHALL be able to read every other dialect's
page without relearning.

Where two machines take the same argument in the same position, both pages SHALL
describe it identically, so that any visible difference between two pages is a
difference between the two BASICs rather than between the two pages.

Where a command's arguments mean materially different things — a sound channel and a
pitch, a screen coordinate and a colour, an address and the byte stored at it — each
argument SHALL be named for what it is, rather than all of them being named for their
shared type. A reader SHALL be able to tell which argument is which from the reference
entry alone, without inferring it from the description or from a hardware page.

#### Scenario: Reading the same command on two machines

- **WHEN** the user consults the reference entry for a command that two machines both
  provide, and both machines take the same arguments
- **THEN** both pages describe those arguments identically

#### Scenario: A command whose arguments mean different things

- **WHEN** the user consults the reference entry for a command taking several arguments
  of the same type but with different meanings
- **THEN** each argument is named for its meaning, and the reader can tell which
  position carries which

#### Scenario: Meeting an unfamiliar argument name

- **WHEN** the user meets an argument name they do not recognise on a reference page
- **THEN** that page states what it means, for every argument name that page uses, and
  states nothing for names it does not use

#### Scenario: Learning how the notation itself works

- **WHEN** the user wants to know what the optional, alternative, repetition and
  literal markings mean
- **THEN** that is explained once and reachable from every dialect's reference page

#### Scenario: A machine's real syntax outranks the notation

- **WHEN** a machine genuinely requires a punctuation, spacing or literal form that the
  shared notation would otherwise smooth away
- **THEN** the reference entry shows what the machine actually requires

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
